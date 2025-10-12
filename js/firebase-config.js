// Firebase App (the core Firebase SDK) is always required
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    sendEmailVerification,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    set,
    get,
    child,
    update,
    push,
    off,
    onValue,
    query,
    orderByChild,
    equalTo
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-database.js";
import { 
    getStorage, 
    ref as storageRef,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCzoyofIoA94KX1amlrkEEFixiaxUp5NwA",
    authDomain: "pet-grooming-a465a.firebaseapp.com",
    databaseURL: "https://pet-grooming-a465a-default-rtdb.firebaseio.com",
    projectId: "pet-grooming-a465a",
    storageBucket: "pet-grooming-a465a.firebasestorage.app",
    messagingSenderId: "996754429625",
    appId: "1:996754429625:web:1181b18d86740323aced68",
    measurementId: "G-QC2X11MK73"
};

// Create a staff Firebase Auth user without affecting the current session,
// and save their admin profile at admin/{uid}.
export const createStaffAuthAndProfile = async (email, password, profile) => {
    const secondary = initializeApp(firebaseConfig, 'Secondary');
    const secondaryAuth = getAuth(secondary);
    try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const uid = cred.user.uid;
        const adminProfile = {
            name: profile?.name || '',
            email,
            phone: profile?.phone || '',
            role: profile?.role || 'admin',
            status: 'active',
            createdAt: new Date().toISOString()
        };
        await set(ref(database, `admin/${uid}`), adminProfile);
        try { await sendEmailVerification(cred.user); } catch {}
        return { success: true, uid };
    } catch (e) {
        return { success: false, error: e?.message || 'Failed to create staff account', code: e?.code };
    } finally {
        try { await secondaryAuth.signOut(); } catch {}
    }
};

// Admin-only Sign In
export const signInAdmin = async (email, password) => {
    try {
        // Ensure persistence is local so admin session survives refresh
        await setPersistence(auth, browserLocalPersistence);
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const user = cred?.user;
        if (!user?.uid) {
            return { success: false, error: 'Failed to sign in' };
        }
        // Read admin profile
        const adminRef = ref(database, `admin/${user.uid}`);
        const snap = await get(adminRef);
        if (!snap.exists()){
            try { await auth.signOut(); } catch {}
            return { success: false, error: 'No admin profile found' };
        }
        const profile = snap.val() || {};
        const role = String(profile?.role || '').toLowerCase();
        const allowed = ['superadmin','admin','manager / owner','pet groomer','grooming assistant / bather','receptionist','pet care attendant'];
        if (!allowed.includes(role)){
            try { await auth.signOut(); } catch {}
            return { success: false, error: 'Insufficient role' };
        }
        // Write lastLogin to admin path only
        try { await set(ref(database, `admin/${user.uid}/lastLogin`), new Date().toISOString()); } catch {}
        return { success: true, user, profile };
    } catch (e) {
        return { success: false, error: e?.message || 'Authentication failed' };
    }
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);
export const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// Re-export all the Firebase functions we're using
export { 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    sendEmailVerification,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    updateProfile,
    ref,
    set,
    get,
    child,
    update,
    off,
    push,
    storageRef,
    uploadBytes,
    getDownloadURL,
    query,
    orderByChild,
    equalTo,
    onValue
};

// Set persistence
setPersistence(auth, browserLocalPersistence);

// Email/Password Sign Up
export const signUpWithEmail = async (email, password, userData) => {
    console.log('Starting sign up process for:', email);
    
    try {
        // 1. Create user in Firebase Authentication
        console.log('Creating user in Firebase Authentication...');
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log('User created with UID:', user.uid);
        
        // 2. Prepare user data for database
        const userProfile = {
            name: userData.name || '',
            email: user.email,
            phone: userData.phone || '',
            emailVerified: false,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            role: 'user', // Default role
            status: 'active' // Track user status
        };

        // 3. Save user data to Realtime Database
        console.log('Saving user data to database...');
        try {
            await set(ref(database, 'users/' + user.uid), userProfile);
            console.log('User data saved to database');
            
            // 4. Update user profile with display name if provided
            if (userData.name) {
                console.log('Updating user profile with display name...');
                try {
                    await updateProfile(user, {
                        displayName: userData.name
                    });
                    console.log('User profile updated with display name');
                } catch (profileError) {
                    console.error('Error updating profile:', profileError);
                    // Non-critical error, continue with registration
                }
            }
            
            // 5. Send email verification
            console.log('Sending email verification...');
            try {
                await sendEmailVerification(user);
                console.log('Verification email sent');
                
                // Sign out the user after successful registration
                try {
                    await auth.signOut();
                    console.log('User signed out after registration');
                } catch (signOutError) {
                    console.error('Error signing out after registration:', signOutError);
                    // Non-critical error, continue
                }
                
                return { 
                    success: true, 
                    user: {
                        uid: user.uid,
                        email: user.email,
                        emailVerified: user.emailVerified,
                        displayName: user.displayName
                    },
                    message: 'Registration successful! Please check your email to verify your account.'
                };
                
            } catch (emailError) {
                console.error('Error sending verification email:', emailError);
                // Still return success since user was created, but with a warning
                return { 
                    success: true, 
                    user: {
                        uid: user.uid,
                        email: user.email,
                        emailVerified: user.emailVerified,
                        displayName: user.displayName
                    },
                    warning: 'Account created successfully, but we couldn\'t send a verification email. Please sign in and request a new verification email.' 
                };
            }
        } catch (dbError) {
            console.error('Error saving user data:', dbError);
            // If database save fails, we should delete the user to maintain consistency
            try {
                console.log('Attempting to rollback user creation due to database error...');
                await user.delete();
                console.log('Successfully rolled back user creation');
            } catch (deleteError) {
                console.error('Error cleaning up after database error:', deleteError);
                // If we can't delete the user, we should log this for admin review
                // In a production app, you might want to have an admin notification system
            }
            
            // Return a more specific error message
            let errorMessage = 'Failed to save user data. Please try again.';
            if (dbError.code === 'PERMISSION_DENIED') {
                errorMessage = 'Permission denied. Please contact support.';
            } else if (dbError.code === 'UNAVAILABLE') {
                errorMessage = 'Database is currently unavailable. Please try again later.';
            }
            
            throw new Error(errorMessage);
        }
    } catch (error) {
        console.error("Error in signUpWithEmail:", {
            code: error.code,
            message: error.message,
            stack: error.stack
        });
        
        let errorMessage = 'Failed to create account. Please try again.';
        
        // More user-friendly error messages
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'This email is already registered. Please use a different email or sign in.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password should be at least 6 characters';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Please enter a valid email address';
        } else if (error.code === 'auth/operation-not-allowed') {
            errorMessage = 'Email/password accounts are not enabled. Please contact support.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many sign-up attempts. Please try again later or reset your password.';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your internet connection and try again.';
        }
        
        return { 
            success: false, 
            error: errorMessage,
            code: error.code || 'unknown_error'
        };
    }
};

// Google Sign In
export const signInWithGoogle = async () => {
    try {
        // Check if we're on an authorized domain in production
        if (window.location.hostname !== 'localhost' && 
            window.location.hostname !== '127.0.0.1' &&
            !window.location.hostname.endsWith('.firebaseapp.com')) {
            console.warn('Signing in from potentially unauthorized domain:', window.location.hostname);
        }

        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        
        // Check if user exists in database
        const userRef = ref(database, 'users/' + user.uid);
        const snapshot = await get(userRef);
        
        if (!snapshot.exists()) {
            // Save user data if new user
            await set(userRef, {
                name: user.displayName,
                email: user.email,
                emailVerified: user.emailVerified,
                photoURL: user.photoURL,
                provider: 'google.com',
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
                role: 'user' // Default role
            });
        } else {
            // Update last login
            await set(ref(database, `users/${user.uid}/lastLogin`), new Date().toISOString());
        }
        
        // Store user data in session
        const userData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            emailVerified: user.emailVerified
        };
        
        // Set auth state persistence
        await setPersistence(auth, browserLocalPersistence);
        
        return { success: true, user: userData };
    } catch (error) {
        console.error("Error signing in with Google:", error);
        
        // More specific error handling
        let errorMessage = error.message;
        if (error.code === 'auth/unauthorized-domain') {
            errorMessage = 'This domain is not authorized. Please contact support or try from a different domain.';
        } else if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Sign in was cancelled. Please try again.';
        } else if (error.code === 'auth/account-exists-with-different-credential') {
            errorMessage = 'An account already exists with the same email but different sign-in credentials.';
        }
        
        return { 
            success: false, 
            error: errorMessage,
            code: error.code 
        };
    }
};

// Email/Password Sign In
export const signInWithEmail = async (email, password, rememberMe = false) => {
    console.log('Starting sign in for:', email);
    
    try {
        // Set persistence based on remember me
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);
        
        // Sign in with email and password
        console.log('Attempting Firebase authentication...');
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log('Firebase authentication successful, UID:', user.uid);
        
        // Get the latest user data to ensure we have the most recent email verification status
        console.log('Refreshing user data...');
        await user.reload();
        
        try {
            // Update last login in database
            console.log('Updating last login timestamp...');
            await set(ref(database, `users/${user.uid}/lastLogin`), new Date().toISOString());
            
            // Get additional user data from database
            console.log('Fetching user profile data...');
            const userRef = ref(database, 'users/' + user.uid);
            const snapshot = await get(userRef);
            const userData = snapshot.val() || {};
            
            // If email was just verified, update the database
            if (user.emailVerified && (!userData.emailVerified || userData.emailVerified === false)) {
                console.log('Email verification status updated, saving to database...');
                await set(ref(database, `users/${user.uid}/emailVerified`), true);
                userData.emailVerified = true;
            }
            
            // Return complete user object with additional data
            const completeUser = {
                ...user,
                ...userData,
                emailVerified: user.emailVerified || userData.emailVerified || false
            };
            
            console.log('Sign in successful for user:', user.uid);
            return {
                success: true,
                user: completeUser
            };
            
        } catch (dbError) {
            console.error('Database operation failed:', dbError);
            // Even if database operations fail, we can still allow login
            return {
                success: true,
                user: {
                    ...user,
                    emailVerified: user.emailVerified || false
                }
            };
        }
        
    } catch (error) {
        console.error('Authentication failed:', error);
        
        // Map Firebase error codes to user-friendly messages
        let errorMessage = 'Failed to sign in. Please try again.';
        
        if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect email or password.';
        } else if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email. Please sign up first.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many failed attempts. Please try again later or reset your password.';
        } else if (error.code === 'auth/user-disabled') {
            errorMessage = 'This account has been disabled. Please contact support.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'The email address is not valid.';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your internet connection.';
        }
        
        return { 
            success: false, 
            error: {
                code: error.code,
                message: errorMessage
            }
        };
    }
};

// Check auth state
export const checkAuthState = (callback) => {
    return onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Get additional user data from database
            const userRef = ref(database, 'users/' + user.uid);
            const snapshot = await get(userRef);
            const userData = snapshot.val() || {};
            
            // Merge auth user with database data
            const completeUser = {
                ...user,
                ...userData,
                emailVerified: user.emailVerified
            };
            
            callback(completeUser);
        } else {
            callback(null);
        }
    });
};

// Sign Out
export const signOutUser = async () => {
    console.log('Signing out user...');
    try {
        if (!auth) {
            console.error('Auth not initialized');
            return { success: false, error: 'Authentication not initialized' };
        }
        // Ensure a valid persistence is set; default to local for sign out safety
        try {
            await setPersistence(auth, browserLocalPersistence);
        } catch (persistErr) {
            console.warn('Could not set persistence during sign out:', persistErr);
        }
        
        const currentUser = auth.currentUser;
        console.log('Current user before sign out:', currentUser ? currentUser.uid : 'No user');
        
        await auth.signOut();
        
        // Verify the user is actually signed out
        if (auth.currentUser) {
            console.error('User still authenticated after sign out');
            return { success: false, error: 'Failed to sign out' };
        }
        
        console.log('User signed out successfully');
        return { success: true };
        
    } catch (error) {
        console.error('Error in signOutUser:', {
            code: error.code,
            message: error.message,
            stack: error.stack
        });
        return { 
            success: false, 
            error: error.message || 'Failed to sign out',
            code: error.code
        };
    }
};
