import React from 'react';
import { useAuth } from './AuthContext';

const LoginButton: React.FC = () => {
  const { user, signInWithGoogle, signOut } = useAuth();

  if (user) {
    return (
      <div className="auth-section">
        {user.photoURL && (
          <img src={user.photoURL} alt="" className="user-avatar" referrerPolicy="no-referrer" />
        )}
        <span className="user-name">{user.displayName}</span>
        <button onClick={signOut} className="auth-btn sign-out-btn" title="Sign out">
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="auth-section">
      <button onClick={signInWithGoogle} className="auth-btn sign-in-btn" title="Sign in to sync saved sentences">
        Sign in with Google
      </button>
    </div>
  );
};

export default LoginButton;
