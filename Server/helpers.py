from flask import session
from models import User
#admin login
ADMIN_EMAIL = "admin@questlog.com"
#auth helpers
def get_current_user():
    """Return the logged-in User instance or None."""
    uid = session.get("user_id")
    return User.query.get(uid) if uid else None
 
 
def login_required():
    """
    Returns (user, None) when a valid session exists.
    Returns (None, error_tuple) when the user is not logged in.
    """
    user = get_current_user()
    if not user:
        return None, ({"error": "Login required."}, 401)
    return user, None
 
 
def admin_required():
    """
    Returns (user, None) for the admin account.
    Returns (None, error_tuple) for anyone else.
    """
    user = get_current_user()
    if not user:
        return None, ({"error": "Login required."}, 401)
    if user.email != ADMIN_EMAIL:
        return None, ({"error": "Admin access required."}, 403)
    return user, None
 
 
def owner_or_admin(resource_creator_id):
    """
    Returns (user, None) if the current user created the resource or is admin.
    Returns (None, error_tuple) otherwise.
    """
    user = get_current_user()
    if not user:
        return None, ({"error": "Login required."}, 401)
    if user.id != resource_creator_id and user.email != ADMIN_EMAIL:
        return None, ({"error": "You do not have permission to modify this resource."}, 403)
    return user, None