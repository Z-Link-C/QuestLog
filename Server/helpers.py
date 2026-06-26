from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from models import User
#auth helpers
def get_current_user():
    """Return the logged-in User instance or None."""
    try:
        verify_jwt_in_request(optional=True)
    except Exception:
        return None
    identity = get_jwt_identity()
    if not identity:
        return None
    return User.query.get(int(identity))
 
def login_required():
    """
    Returns (user, None) when a valid session exists.
    Returns (None, error_tuple) when the user is not logged in.
    """
    try:
        verify_jwt_in_request()
    except Exception:
        return None, ({"error": "Login required."}, 401)
    user = get_current_user()
    if not user:
        return None, ({"error": "Login required."}, 401)
    return user, None
 
def admin_required():
    """
    Returns (user, None) for the admin account.
    Returns (None, error_tuple) for anyone else.
    """
    user, err = login_required()
    if err:
        return None, err
    if not user.is_admin:
        return None, ({"error": "Admin access required."}, 403)
    return user, None
 
def owner_or_admin(resource_creator_id):
    """
    Returns (user, None) if the current user created the resource or is admin.
    Returns (None, error_tuple) otherwise.
    """
    user, err = login_required()
    if err:
        return None, err
    if user.id != resource_creator_id and not user.is_admin:
        return None, ({"error": "You do not have permission to modify this resource."}, 403)
    return user, None