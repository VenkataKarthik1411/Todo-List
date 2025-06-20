import { API_BASE_URL } from './constants.js';

// Make the callback function globally available
window.handleGoogleCredentialResponse = function(response) {
    try {
        console.log("Google credential response received:", response);
        
        // The response.credential contains the JWT token from Google
        const credential = response.credential;

        console.log("Google credential:", credential);
        
        // Decode the JWT token to get user information
        const payload = parseJwt(credential);
        console.log("Decoded user info:", payload);
        
        // Determine if this is login or signup based on active form
        const wrapper = document.querySelector('.wrapper');
        const action = wrapper.classList.contains('active') ? 'signup' : 'signin';
        
        // Send the token to your backend
        sendGoogleTokenToBackend(credential, action, payload);
    } catch (error) {
        console.error("Error handling Google credential:", error);
        showErrorMessage(new Error("Failed to process Google Sign-In"));
    }
};

// Function to send Google token to your backend
async function sendGoogleTokenToBackend(token, action, userInfo) {
    try {
        console.log("Sending token to backend:", token, action, userInfo);
        
        // Important: Send the raw token as text, not wrapped in JSON
        const response = await fetch(`${API_BASE_URL}/auth/google-${action}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',  // Critical: Content type must be text/plain
                'Accept': 'application/json'
            },
            body: token  // Send the raw token string directly
        });

        // Log full response for debugging
        console.log(`Backend response status: ${response.status} ${response.statusText}`);
        
        const data = await response.json();
        console.log("Backend response data:", data);

        if (!response.ok) {
            let errorMessage = "Authentication failed";
            
            // Handle specific status codes
            if (response.status === 401) {
                errorMessage = "Google authentication failed - Invalid token";
            } else if (response.status === 409) {
                errorMessage = "This Google account is already registered. Please sign in instead.";
                // Switch to sign in form
                document.querySelector('.wrapper').classList.remove('active');
            } else if (response.status === 404) {
                errorMessage = "Account not found. Please sign up first.";
                // Switch to sign up form
                document.querySelector('.wrapper').classList.add('active');
            }
            
            throw new Error(errorMessage);
        }

        if (data.status === true && data.jwt) {
            // Store user data in localStorage
            const userData = {
                jwt: data.jwt,
                email: userInfo.email
            };
            
            if (action === 'signin') {
                localStorage.setItem('userData', JSON.stringify(userData));
                // Redirect to home/dashboard page after successful sign in
                showSuccessMessage("Sign in successful! Redirecting...");
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            } else {
                // For signup, show success message and switch to signin form
                showSuccessMessage("Account created successfully! Please sign in.");
                // Switch to sign in form
                setTimeout(() => {
                    document.querySelector('.wrapper').classList.remove('active');
                }, 1500);
            }
        } else {
            throw new Error(`Google ${action} failed`);
        }
    } catch (error) {
        showErrorMessage(error);
    }
}

// Parse the JWT token to extract user information
function parseJwt(token) {
    try {
        // Split the token and get the middle part (payload)
        const base64Url = token.split('.')[1];
        // Convert base64url to base64
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        // Decode the base64 string
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        // Parse the JSON
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error("Error parsing JWT:", error);
        return {};
    }
}

function showErrorMessage(error) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = 'Error: ' + (error.message || 'An unexpected error occurred');
    errorMessage.style.display = 'block';
    errorMessage.className = 'error-message';
    
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
    
    console.error('Error:', error);
}

function showSuccessMessage(message) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    errorMessage.className = 'success-message';
    
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

async function debugToken(token) {
    try {
        const response = await fetch(`${API_BASE_URL}/debug/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: token
        });
        
        const data = await response.json();
        console.log('Debug info:', data);
        return data;
    } catch (error) {
        console.error('Debug error:', error);
    }
}
