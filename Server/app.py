from flask import request
from flask_restful import Resource
from flask_jwt_extended import create_access_token
from marshmallow import ValidationError
from datetime import datetime,timezone
from config import app, db, api
from models import (
    User, Task, Project, 
    Assignment, Dependency, 
    UserSchema, TaskSchema,
    LoginSchema, ProjectSchema,
    AssignmentSchema,DependencySchema
    )

from helpers import (
    get_current_user, login_required, 
    admin_required, owner_or_admin)

#Auth
class CheckSession(Resource):
    def get(self):
        """GET /check_session — returns the logged-in user or 401."""
        user, err = login_required()
        if err:
            return err
        user_schema=UserSchema()
        return user_schema.dump(user), 200

class Login(Resource):
    def post(self):
        """POST /login — { email, password } → sets session and returns user."""
        try:
            login_schema=LoginSchema()
            data = login_schema.load(request.json or {})
        except ValidationError as e:
            return {"error": e.messages}, 422
 
        user = User.query.filter_by(email=data["email"].lower().strip()).first()
        if not user or not user.check_password(data["password"]):
            return {"error": "Invalid email or password."}, 401
 
        access_token = create_access_token(identity=str(user.id))
        user_schema=UserSchema()
        return {**user_schema.dump(user), "access_token": access_token}, 200
 
 
class Logout(Resource):
    def delete(self):
        """DELETE /logout — clears the session."""
        return {}, 204

#Users
class UserList(Resource):
    def get(self):
        """GET /users — admin only: returns all users."""
        _, err = admin_required()
        if err:
            return err
        users_schema = UserSchema(many=True)
        return users_schema.dump(User.query.all()), 200
 
    def post(self):
        """POST /users — register a new account (public)."""
        user_schema = UserSchema() # Fixed: Instantiate schema
        try:
            data = user_schema.load(request.json or {})
        except ValidationError as e:
            return {"error": e.messages}, 422
 
        if User.query.filter_by(email=data["email"].lower().strip()).first():
            return {"error": "An account with that email already exists."}, 409
 
        user = User(name=data["name"], email=data["email"].lower().strip())
        user.password = data["password"]
        db.session.add(user)
        db.session.commit()
 
        access_token = create_access_token(identity=str(user.id))
        return {**user_schema.dump(user), "access_token": access_token}, 201
 
class UserById(Resource):
    def get(self, user_id):
        """GET /users/<id> — self or admin."""
        current, err = login_required()
        if err:
            return err
 
        target = User.query.get(user_id)
        if not target:
            return {"error": "User not found."}, 404
        if current.id != target.id and not current.is_admin: # Fixed conditional logic
            return {"error": "Access denied."}, 403
        
        user_schema = UserSchema()
        return user_schema.dump(target), 200
 
    def patch(self, user_id):
        """PATCH /users/<id> — update name or avatar (self or admin)."""
        current, err = login_required()
        if err:
            return err
 
        target = User.query.get(user_id)
        if not target:
            return {"error": "User not found."}, 404
        if current.id != target.id and not current.is_admin: # Fixed conditional logic
            return {"error": "Access denied."}, 403
 
        data = request.json or {}
        if "name"   in data: target.name   = data["name"]
        if "avatar" in data: target.avatar = data["avatar"]
        if "password" in data: target.password = data["password"]
 
        db.session.commit()

        user_schema = UserSchema()
        return user_schema.dump(target), 200
 
    def delete(self, user_id):
        """DELETE /users/<id> — admin only."""
        _, err = admin_required()
        if err:
            return err
 
        target = User.query.get(user_id)
        if not target:
            return {"error": "User not found."}, 404
 
        db.session.delete(target)
        db.session.commit()
        return {}, 204

#Projects
class ProjectList(Resource):
    def get(self):
        """
        GET /projects
        Admin  → all projects.
        User   → projects they created + projects they are assigned to.
        """
        user, err = login_required()
        if err:
            return err
 
        if user.is_admin:
            projects = Project.query.all()
        else:
            # created by user
            created = Project.query.filter_by(creator_id=user.id).all()
            # assigned to user (via project-scoped assignments)
            assigned_ids = [
                a.project_id for a in user.assignments_received if a.project_id
            ]
            assigned = Project.query.filter(Project.id.in_(assigned_ids)).all()
            # merge, deduplicate by id
            seen, projects = set(), []
            for p in created + assigned:
                if p.id not in seen:
                    seen.add(p.id)
                    projects.append(p)
        
        projects_schema = ProjectSchema(many=True)
        return projects_schema.dump(projects), 200
    
    def post(self):
        user, err = login_required()
        if err: return err
        project_schema=ProjectSchema()
        data = request.get_json()
        
        # post_load inside the schema returns the Project instance
        new_project = project_schema.load(data)
        new_project.creator_id = user.id
        
        db.session.add(new_project)
        db.session.commit()
        return project_schema.dump(new_project), 201
 
class ProjectById(Resource):
    def get(self, project_id):
        """GET /projects/<id> — returns project with its tasks."""
        user, err = login_required()
        if err:
            return err
 
        project = Project.query.get(project_id)
        if not project:
            return {"error": "Project not found."}, 404
 
        tasks_schema  = TaskSchema(many=True)
        project_schema  = ProjectSchema()
        result = project_schema.dump(project)
        result["tasks"] = tasks_schema.dump(project.tasks)
        return result, 200
 
    def patch(self, project_id):
        """PATCH /projects/<id> — update name or description (creator or admin)."""
        project = Project.query.get(project_id)
        if not project:
            return {"error": "Project not found."}, 404
 
        _, err = owner_or_admin(project.creator_id)
        if err:
            return err
 
        data = request.json or {}
        if "name" in data: project.name = data["name"]
        if "description" in data: project.description = data["description"]
 
        db.session.commit()

        project_schema  = ProjectSchema()
        return project_schema.dump(project), 200
 
    def delete(self, project_id):
        """DELETE /projects/<id> — creator or admin only."""
        project = Project.query.get(project_id)
        if not project:
            return {"error": "Project not found."}, 404
 
        _, err = owner_or_admin(project.creator_id)
        if err:
            return err
 
        db.session.delete(project)
        db.session.commit()
        return {}, 204

#Tasks
class TaskList(Resource):
    def get(self):
        """
        GET /tasks?project_id=<id>
        Returns tasks for a project. Admin sees all; others see only their projects.
        """
        user, err = login_required()
        if err:
            return err
 
        project_id = request.args.get("project_id", type=int)
        if not project_id:
            return {"error": "project_id query parameter is required."}, 400
 
        project = Project.query.get(project_id)
        if not project:
            return {"error": "Project not found."}, 404
 
        # verify access
        is_creator  = project.creator_id == user.id
        is_assigned = any(a.project_id == project_id for a in user.assignments_received)
        if not (is_creator or is_assigned or user.is_admin):
            return {"error": "Access denied."}, 403
 
        tasks_schema = TaskSchema(many=True)
        return tasks_schema.dump(project.tasks), 200
 
    def post(self):
        """POST /tasks — create a task inside a project."""
        user, err = login_required()
        if err:
            return err
 
        try:
            task_schema = TaskSchema()
            data = task_schema.load(request.json or {})
        except ValidationError as e:
            return {"error": e.messages}, 422
 
        project = Project.query.get(data["project_id"])
        if not project:
            return {"error": "Project not found."}, 404
        if project.creator_id != user.id and not user.is_admin:
            return {"error": "Only the project creator can add tasks."}, 403
 
        task = Task(
            project_id=data["project_id"],
            name=data["name"],
            description=data.get("description"),
            est_minutes=data["est_minutes"], # @validates auto-sets xp_value
            is_timed=data.get("is_timed", False),
            deadline=data.get("deadline"),
            parent_task_id=data.get("parent_task_id"),
        )
        db.session.add(task)
        db.session.commit()
        return task_schema.dump(task), 201
  
class TaskById(Resource):
    def get(self, task_id):
        """GET /tasks/<id>."""
        _, err = login_required()
        if err:
            return err
 
        task = Task.query.get(task_id)
        if not task:
            return {"error": "Task not found."}, 404
        
        task_schema  = TaskSchema()
        return task_schema.dump(task), 200
 
    def patch(self, task_id):
        """PATCH /tasks/<id> — update any writable field."""
        task = Task.query.get(task_id)
        if not task:
            return {"error": "Task not found."}, 404
 
        _, err = owner_or_admin(task.project.creator_id)
        if err:
            return err
 
        data = request.json or {}
        if "name" in data: task.name = data["name"]
        if "description" in data: task.description = data["description"]
        if "est_minutes" in data: task.est_minutes = data["est_minutes"]  # re-triggers @validates
        if "is_timed" in data: task.is_timed = data["is_timed"]
        if "deadline" in data: task.deadline = data["deadline"]
 
        db.session.commit()

        task_schema = TaskSchema()
        return task_schema.dump(task), 200
 
    def delete(self, task_id):
        """DELETE /tasks/<id> — project creator or admin."""
        task = Task.query.get(task_id)
        if not task:
            return {"error": "Task not found."}, 404
 
        _, err = owner_or_admin(task.project.creator_id)
        if err:
            return err
 
        db.session.delete(task)
        db.session.commit()
        return {}, 204
  
class TaskComplete(Resource):
    def post(self, task_id):
        """
        POST /tasks/<id>/complete
        Marks the task done, awards XP to all assignees.
        Returns 409 if the task is blocked by incomplete prerequisites.
        """
        user, err = login_required()
        if err:
            return err
 
        task = Task.query.get(task_id)
        if not task:
            return {"error": "Task not found."}, 404
        if task.completed:
            return {"error": "Task is already completed."}, 409
 
        try:
            task.complete()    # raises ValueError if blocked
        except ValueError as e:
            return {"error": str(e)}, 409
 
        task.completed = True
        task.completed_at = datetime.now(timezone.utc)
        xp_gained = task.xp_value or 0

        # 2. Add the value to the current active session user
        user.xp_total += xp_gained
 
        break_unlocked = any(
            a.assignee.xp_total % 100 < task.xp_value
            for a in task.assignments
        )
        db.session.commit()
        task_schema = TaskSchema()
        return {
            "task": task_schema.dump(task),
            "xp_total": user.xp_total,
            "xp_gained": xp_gained
        }, 200

#Assignments
class AssignmentList(Resource):
    def post(self):
        """
        POST /assignments
        Body: { user_id, project_id } OR { user_id, task_id }
        Only the project/task creator or admin can assign people.
        """
        assigner, err = login_required()
        if err:
            return err
 
        data = request.json or {}
 
        # Validate XOR (project OR task, not both/neither)
        has_project = bool(data.get("project_id"))
        has_task = bool(data.get("task_id"))
        if has_project == has_task:
            return {"error": "Provide exactly one of 'project_id' or 'task_id'."}, 422
 
        # Confirm the target user exists
        target_user = User.query.get(data.get("user_id"))
        if not target_user:
            return {"error": "User not found."}, 404
 
        # Confirm the resource exists and the assigner owns it
        if has_project:
            resource = Project.query.get(data["project_id"])
            if not resource:
                return {"error": "Project not found."}, 404
            if resource.creator_id != assigner.id and not assigner.is_admin:
                return {"error": "Only the project creator can assign users."}, 403
            assignment = Assignment(
                user_id=target_user.id,
                assigned_by=assigner.id,
                project_id=resource.id,
            )
        else:
            resource = Task.query.get(data["task_id"])
            if not resource:
                return {"error": "Task not found."}, 404
            if resource.project.creator_id != assigner.id and not assigner.is_admin:
                return {"error": "Only the project creator can assign tasks."}, 403
            assignment = Assignment(
                user_id=target_user.id,
                assigned_by=assigner.id,
                task_id=resource.id,
            )
 
        db.session.add(assignment)
        db.session.commit()

        assignment_schema=AssignmentSchema()
        return assignment_schema.dump(assignment), 201
  
class AssignmentById(Resource):
    def delete(self, assignment_id):
        """DELETE /assignments/<id> — assigner or admin only."""
        user, err = login_required()
        if err:
            return err
 
        assignment = Assignment.query.get(assignment_id)
        if not assignment:
            return {"error": "Assignment not found."}, 404
        if assignment.assigned_by != user.id and user.email != user.is_admin:
            return {"error": "Only the assigner can remove this assignment."}, 403
 
        db.session.delete(assignment)
        db.session.commit()
        return {}, 204

#Dependencies
class DependencyList(Resource):
    def post(self):
        """
        POST /dependencies
        Body: { task_id, predecessor_id }
        Adds a 'task cannot start until predecessor is done' rule.
        """
        user, err = login_required()
        if err:
            return err
 
        dependency_schema = DependencySchema() # Fixed: Instantiate schema
        try:
            data = dependency_schema.load(request.json or {})
        except ValidationError as e:
            return {"error": e.messages}, 422
 
        if data["task_id"] == data["predecessor_id"]:
            return {"error": "A task cannot depend on itself."}, 422
 
        task = Task.query.get(data["task_id"])
        predecessor = Task.query.get(data["predecessor_id"])
 
        if not task:
            return {"error": "Task not found."}, 404
        if not predecessor:
            return {"error": "Predecessor task not found."}, 404
        if task.project.creator_id != user.id and not user.is_admin:
            return {"error": "Only the project creator can add dependencies."}, 403
 
        # Check for duplicate
        exists = Dependency.query.get((data["task_id"], data["predecessor_id"]))
        if exists:
            return {"error": "This dependency already exists."}, 409
 
        dep = Dependency(task_id=data["task_id"], predecessor_id=data["predecessor_id"])
        db.session.add(dep)
        db.session.commit()
        return dependency_schema.dump(dep), 201
 
class DependencyById(Resource):
    def delete(self, task_id, predecessor_id):
        """DELETE /dependencies/<task_id>/<predecessor_id> — project creator or admin."""
        user, err = login_required()
        if err:
            return err
 
        dep = Dependency.query.get((task_id, predecessor_id))
        if not dep:
            return {"error": "Dependency not found."}, 404
        if dep.task.project.creator_id != user.id and not user.is_admin:
            return {"error": "Only the project creator can remove dependencies."}, 403
 
        db.session.delete(dep)
        db.session.commit()
        return {}, 204
#Routes

# Auth
api.add_resource(CheckSession, "/check_session")
api.add_resource(Login, "/login")
api.add_resource(Logout, "/logout")
 
# Users
api.add_resource(UserList, "/users")
api.add_resource(UserById, "/users/<int:user_id>")
 
# Projects
api.add_resource(ProjectList, "/projects")
api.add_resource(ProjectById, "/projects/<int:project_id>")
 
# Tasks
api.add_resource(TaskList, "/tasks")
api.add_resource(TaskById, "/tasks/<int:task_id>")
api.add_resource(TaskComplete, "/tasks/<int:task_id>/complete")
 
# Assignments
api.add_resource(AssignmentList, "/assignments")
api.add_resource(AssignmentById, "/assignments/<int:assignment_id>")
 
# Dependencies
api.add_resource(DependencyList, "/dependencies")
api.add_resource(DependencyById, "/dependencies/<int:task_id>/<int:predecessor_id>")
 
 
if __name__ == "__main__":
    app.run(port=5555, debug=True)