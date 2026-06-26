from sqlalchemy.orm import validates
from sqlalchemy.ext.hybrid import hybrid_property
from marshmallow import Schema, fields, post_load
from datetime import datetime, timezone

from config import db, bcrypt, ma 

#constants
XP_PER_MIN=2
BOSS_THRESH=5
BREAK_THRESH=100

#user
class User(db.Model):
    __tablename__ = "users"
 
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    xp_total = db.Column(db.Integer, default=0, nullable=False)
    avatar = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    
    created_projects = db.relationship("Project",    foreign_keys="[Project.creator_id]",    back_populates="creator")
    assignments_received = db.relationship("Assignment", foreign_keys="[Assignment.user_id]",     back_populates="assignee", cascade="all, delete-orphan")
    assignments_given = db.relationship("Assignment", foreign_keys="[Assignment.assigned_by]", back_populates="assigner")
 
    # Password (bcrypt via config) 
    @hybrid_property
    def password(self):
        raise AttributeError("password is write-only")
 
    @password.setter
    def password(self, plaintext):
        self.password_hash = bcrypt.generate_password_hash(plaintext).decode("utf-8")
 
    def check_password(self, plaintext) -> bool:
        return bcrypt.check_password_hash(self.password_hash, plaintext)
 
    def add_xp(self, amount: int) -> bool:
        """Add XP; returns True if a break threshold was crossed. {might change}"""
        before = self.xp_total // BREAK_THRESH
        self.xp_total += amount
        return (self.xp_total // BREAK_THRESH) > before
 
    def __repr__(self):
        return f"<User {self.id} | {self.name} | {self.xp_total} XP>"
#projects
class Project(db.Model):
    __tablename__ = "projects"
 
    id = db.Column(db.Integer, primary_key=True)
    creator_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    parent_project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    
    creator = db.relationship("User", foreign_keys=[creator_id], back_populates="created_projects")
    parent = db.relationship("Project", remote_side="Project.id", foreign_keys=[parent_project_id], back_populates="sub_projects")
    sub_projects = db.relationship("Project", foreign_keys=[parent_project_id], back_populates="parent")
    tasks = db.relationship("Task", back_populates="project", cascade="all, delete-orphan")
    assignments = db.relationship("Assignment", back_populates="project", cascade="all, delete-orphan")
 
    # Computations (handled at runtime, not stored) 
    @hybrid_property
    def tier(self) -> str:
        if self.sub_projects:
            return "dungeon"
        return "boss" if len(self.tasks) >= BOSS_THRESH else "miniboss"
 
    @hybrid_property
    def xp_earned(self) -> int:
        return sum(t.xp_value for t in self.tasks if t.completed)
 
    @hybrid_property
    def xp_max(self) -> int:
        return sum(t.xp_value for t in self.tasks)
 
    @hybrid_property
    def progress_pct(self) -> float:
        return round(self.xp_earned / self.xp_max * 100, 1) if self.xp_max else 0.0
 
    def __repr__(self):
        return f"<Project {self.id} | {self.name} | {self.tier}>"
#tasks
class Task(db.Model):
    __tablename__ = "tasks"
 
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False)
    parent_task_id = db.Column(db.Integer, db.ForeignKey("tasks.id"),    nullable=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    est_minutes = db.Column(db.Integer, nullable=False, default=30)
    xp_value = db.Column(db.Integer, nullable=False, default=0)
    is_timed = db.Column(db.Boolean, default=False,  nullable=False)
    deadline = db.Column(db.DateTime, nullable=True)
    completed = db.Column(db.Boolean, default=False,  nullable=False)
    completed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
 
    project = db.relationship("Project", back_populates="tasks")
    parent = db.relationship("Task", remote_side="Task.id", foreign_keys=[parent_task_id], back_populates="sub_tasks")
    sub_tasks = db.relationship("Task", foreign_keys=[parent_task_id], back_populates="parent")
    assignments = db.relationship("Assignment", back_populates="task", cascade="all, delete-orphan")
    blocked_by = db.relationship("Dependency", foreign_keys="[Dependency.task_id]", back_populates="task", cascade="all, delete-orphan")
    blocking = db.relationship("Dependency", foreign_keys="[Dependency.predecessor_id]", back_populates="predecessor", cascade="all, delete-orphan")
 
    # XP: runs every time est_minutes is written 
    @validates("est_minutes")
    def auto_xp(self, key, minutes: int) -> int:
        self.xp_value = max(0, minutes) * XP_PER_MIN
        return minutes
 
    # Computed
    @hybrid_property
    def is_blocked(self) -> bool:
        return any(not dep.predecessor.completed for dep in self.blocked_by)
 
    @hybrid_property
    def seconds_remaining(self):
        if not self.is_timed or not self.deadline:
            return None
        delta = self.deadline.replace(tzinfo=timezone.utc) - datetime.now(timezone.utc)
        return max(0, int(delta.total_seconds()))
 
    def complete(self):
        """Mark done and award XP to assignees. Raises if predecessors unfinished."""
        if self.is_blocked:
            raise ValueError(f"'{self.name}' is blocked — finish prerequisites first.")
        self.completed = True
        self.completed_at = datetime.now(timezone.utc)
        for a in self.assignments:
            a.assignee.add_xp(self.xp_value)
 
    def __repr__(self):
        s = "✓" if self.completed else "○"
        return f"<Task {self.id} {s} | {self.name} | {self.xp_value} XP>"
#Assignment
class Assignment(db.Model):
    """project_id XOR task_id — enforced by DB constraint and AssignmentSchema."""
    __tablename__ = "assignments"
 
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    assigned_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=True)
    task_id = db.Column(db.Integer, db.ForeignKey("tasks.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
 
    assignee = db.relationship("User", foreign_keys=[user_id], back_populates="assignments_received")
    assigner = db.relationship("User", foreign_keys=[assigned_by], back_populates="assignments_given")
    project = db.relationship("Project", back_populates="assignments")
    task = db.relationship("Task", back_populates="assignments")
 
    __table_args__ = (
        db.CheckConstraint(
            "(project_id IS NOT NULL AND task_id IS NULL) OR "
            "(project_id IS NULL AND task_id IS NOT NULL)",
            name="ck_assignment_single_scope",
        ),
    )
 
    def __repr__(self):
        scope = f"project={self.project_id}" if self.project_id else f"task={self.task_id}"
        return f"<Assignment {self.id} | user={self.user_id} | {scope}>"
#Dependency
class Dependency(db.Model):
    """predecessor must be DONE before task can start."""
    __tablename__ = "dependencies"
 
    task_id = db.Column(db.Integer, db.ForeignKey("tasks.id"), primary_key=True)
    predecessor_id = db.Column(db.Integer, db.ForeignKey("tasks.id"), primary_key=True)
 
    task = db.relationship("Task", foreign_keys=[task_id], back_populates="blocked_by")
    predecessor = db.relationship("Task", foreign_keys=[predecessor_id], back_populates="blocking")
 
    __table_args__ = (
        db.CheckConstraint("task_id != predecessor_id", name="ck_dependency_no_self_loop"),
    )
 
    def __repr__(self):
        return f"<Dependency task={self.task_id} needs={self.predecessor_id}>"
#Schemas
class UserSchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True)
    email = fields.Email(required=True)
    xp_total = fields.Int(dump_only=True)
    avatar = fields.Str(allow_none=True)
    created_at = fields.DateTime(dump_only=True)
    # load_only: accepted on register/update, never returned in responses
    password = fields.Str(load_only=True, required=True)
    is_admin = fields.Bool(dump_only=True)

 
class LoginSchema(Schema):
    """Used only for POST /login — not tied to a model."""
    email = fields.Email(required=True)
    password = fields.Str(load_only=True, required=True)
 
class ProjectSchema(Schema):
    id = fields.Int(dump_only=True)
    creator_id = fields.Int(dump_only=True)
    parent_project_id = fields.Int(allow_none=True)
    name = fields.Str(required=True)
    description = fields.Str(allow_none=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
    # Derived from hybrid_property — output only
    tier = fields.Str(dump_only=True)
    xp_earned = fields.Int(dump_only=True)
    xp_max = fields.Int(dump_only=True)
    progress_pct = fields.Float(dump_only=True)
    task_count = fields.Method("get_task_count", dump_only=True)
 
    def get_task_count(self, obj):
        return len(obj.tasks)
    
    @post_load
    def make_project(self, data, **kwargs):
        # This converts the validated dictionary into a Project model instance
        return Project(**data)
 
class TaskSchema(Schema):
    id = fields.Int(dump_only=True)
    project_id = fields.Int(required=True)
    parent_task_id = fields.Int(allow_none=True)
    name = fields.Str(required=True)
    description = fields.Str(allow_none=True)
    est_minutes = fields.Int(required=True)
    is_timed = fields.Bool()
    deadline = fields.DateTime(allow_none=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
    # Auto-set by @validates("est_minutes") — output only
    xp_value = fields.Int(dump_only=True)
    # Computed from hybrid_property — output only
    completed = fields.Bool(dump_only=True)
    completed_at = fields.DateTime(dump_only=True, allow_none=True)
    is_blocked = fields.Bool(dump_only=True)
    seconds_remaining = fields.Int(dump_only=True, allow_none=True)
    predecessor_ids = fields.Method("get_predecessor_ids", dump_only=True)
 
    def get_predecessor_ids(self, obj):
        return [dep.predecessor_id for dep in obj.blocked_by]
 
class AssignmentSchema(Schema):
    id = fields.Int(dump_only=True)
    user_id = fields.Int(required=True)
    assigned_by = fields.Int(dump_only=True)
    project_id = fields.Int(allow_none=True)
    task_id = fields.Int(allow_none=True)
    created_at = fields.DateTime(dump_only=True)
 
class DependencySchema(Schema):
    task_id = fields.Int(required=True)
    predecessor_id = fields.Int(required=True)
 
 