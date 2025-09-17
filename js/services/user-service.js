/**
 * User Service
 * Handles user authentication and user data management
 */

import { 
    auth, 
    db, 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc,
    serverTimestamp,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    sendEmailVerification as firebaseSendEmailVerification,
    updateProfile as firebaseUpdateProfile,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail as firebaseSendPasswordResetEmail
} from '../firebase-config.js';

const USER_COLLECTION = 'users';

export class UserService {
    /**
     * Sign in a user with email and password
     * @param {string} email - User's email
     * @param {string} password - User's password
     * @returns {Promise<Object>} - User data or error
     */
    static async signIn(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            const userData = await this.getUserData(user.uid);
            
            return {
                success: true,
                user: {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    emailVerified: user.emailVerified,
                    ...userData
                }
            };
        } catch (error) {
            return {
                success: false,
                error: this._getAuthErrorMessage(error.code)
            };
        }
    }

    /**
     * Register a new user
     * @param {Object} userData - User data
     * @param {string} userData.email - User's email
     * @param {string} userData.password - User's password
     * @param {string} userData.displayName - User's display name
     * @param {Object} additionalData - Additional user data to store
     * @returns {Promise<Object>} - Result of the operation
     */
    static async register({ email, password, displayName }, additionalData = {}) {
        try {
            // Create user account
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Update user profile
            await firebaseUpdateProfile(user, { displayName });
            
            // Create user document in Firestore
            const userData = {
                uid: user.uid,
                email: user.email,
                displayName,
                emailVerified: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                role: 'user',
                status: 'active',
                ...additionalData
            };
            
            await setDoc(doc(db, USER_COLLECTION, user.uid), userData);
            
            // Send verification email
            await this.sendVerificationEmail();
            
            // Sign out the user to force email verification
            await this.signOut();
            
            return {
                success: true,
                user: userData
            };
        } catch (error) {
            // Clean up user if Firestore update fails
            if (auth.currentUser) {
                try {
                    await auth.currentUser.delete();
                } catch (deleteError) {
                    console.error('Error cleaning up user after failed registration:', deleteError);
                }
            }
            
            return {
                success: false,
                error: this._getAuthErrorMessage(error.code)
            };
        }
    }

    /**
     * Sign out the current user
     * @returns {Promise<Object>} - Result of the operation
     */
    static async signOut() {
        try {
            await firebaseSignOut(auth);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: 'Failed to sign out. Please try again.'
            };
        }
    }

    /**
     * Send a password reset email
     * @param {string} email - User's email
     * @returns {Promise<Object>} - Result of the operation
     */
    static async sendPasswordResetEmail(email) {
        try {
            await firebaseSendPasswordResetEmail(auth, email);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: this._getAuthErrorMessage(error.code)
            };
        }
    }

    /**
     * Send a verification email to the current user
     * @returns {Promise<Object>} - Result of the operation
     */
    static async sendVerificationEmail() {
        try {
            const user = auth.currentUser;
            if (!user) {
                return { 
                    success: false, 
                    error: 'No user is currently signed in.' 
                };
            }
            
            await firebaseSendEmailVerification(user, {
                url: `${window.location.origin}/login?verified=true`
            });
            
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: this._getAuthErrorMessage(error.code)
            };
        }
    }

    /**
     * Get user data from Firestore
     * @param {string} userId - User ID
     * @returns {Promise<Object>} - User data
     */
    static async getUserData(userId) {
        try {
            const userDoc = await getDoc(doc(db, USER_COLLECTION, userId));
            if (userDoc.exists()) {
                return userDoc.data();
            }
            return null;
        } catch (error) {
            console.error('Error getting user data:', error);
            return null;
        }
    }

    /**
     * Update user data
     * @param {string} userId - User ID
     * @param {Object} data - Data to update
     * @returns {Promise<Object>} - Result of the operation
     */
    static async updateUserData(userId, data) {
        try {
            const userRef = doc(db, USER_COLLECTION, userId);
            await updateDoc(userRef, {
                ...data,
                updatedAt: serverTimestamp()
            });
            return { success: true };
        } catch (error) {
            console.error('Error updating user data:', error);
            return {
                success: false,
                error: 'Failed to update user data. Please try again.'
            };
        }
    }

    /**
     * Sign in with Google
     * @returns {Promise<Object>} - User data or error
     */
    static async signInWithGoogle() {
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            
            // Check if user exists in Firestore
            const userDoc = await getDoc(doc(db, USER_COLLECTION, user.uid));
            
            if (!userDoc.exists()) {
                // Create user document if it doesn't exist
                const userData = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    emailVerified: user.emailVerified,
                    photoURL: user.photoURL,
                    provider: 'google.com',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    role: 'user',
                    status: 'active'
                };
                
                await setDoc(doc(db, USER_COLLECTION, user.uid), userData);
                
                return {
                    success: true,
                    user: userData,
                    isNewUser: true
                };
            }
            
            return {
                success: true,
                user: userDoc.data(),
                isNewUser: false
            };
        } catch (error) {
            return {
                success: false,
                error: this._getAuthErrorMessage(error.code)
            };
        }
    }

    /**
     * Get a user-friendly error message from an auth error code
     * @private
     */
    static _getAuthErrorMessage(code) {
        const messages = {
            'auth/email-already-in-use': 'An account with this email already exists.',
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/operation-not-allowed': 'This operation is not allowed.',
            'auth/weak-password': 'Password should be at least 6 characters.',
            'auth/user-disabled': 'This account has been disabled.',
            'auth/user-not-found': 'No account found with this email.',
            'auth/wrong-password': 'Incorrect password. Please try again.',
            'auth/too-many-requests': 'Too many attempts. Please try again later.',
            'auth/requires-recent-login': 'Please log in again to perform this action.',
            'auth/account-exists-with-different-credential': 'An account already exists with the same email but different sign-in credentials.',
            'auth/credential-already-in-use': 'This credential is already associated with a different user account.',
            'auth/invalid-credential': 'The credential is malformed or has expired.',
            'auth/operation-not-supported': 'This operation is not supported.',
            'auth/timeout': 'The operation has timed out. Please try again.',
            'auth/user-mismatch': 'The credential given does not correspond to the user.',
            'auth/network-request-failed': 'A network error occurred. Please check your connection and try again.'
        };

        return messages[code] || 'An error occurred. Please try again.';
    }
}

// Export a singleton instance
export const userService = new UserService();
