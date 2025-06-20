import { API_BASE_URL } from './constants.js';
// Wait for DOM content to fully load
document.addEventListener('DOMContentLoaded', () => {
    // Redirect if already logged in
    const userData = localStorage.getItem('userData');
    if (userData) window.location.href = 'index.html';

    // Ensure error message container exists
    if (!document.getElementById('errorMessage')) {
        const errorMessageDiv = document.createElement('div');
        errorMessageDiv.id = 'errorMessage';
        errorMessageDiv.className = 'error-message';
        document.body.appendChild(errorMessageDiv);
    }

    // Add password toggle to both forms
    addPasswordToggle('.form-wrapper.sign-in');
    addPasswordToggle('.form-wrapper.sign-up');
});

// Password visibility toggle
function addPasswordToggle(formSelector) {
    const passwordInput = document.querySelector(`${formSelector} input[type="password"]`);
    if (!passwordInput) return;

    const inputGroup = passwordInput.parentElement;

    const eyeIcon = document.createElement('i');
    eyeIcon.className = 'toggle-password fas fa-eye-slash';
    Object.assign(eyeIcon.style, {
        position: 'absolute',
        right: '10px',
        top: '50%',
        transform: 'translateY(-50%)',
        cursor: 'pointer',
        color: '#fff',
        zIndex: '1'
    });

    eyeIcon.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        eyeIcon.className = isPassword ? 'toggle-password fas fa-eye' : 'toggle-password fas fa-eye-slash';
    });

    inputGroup.style.position = 'relative';
    inputGroup.appendChild(eyeIcon);
}

// DOM elements
const signUpBtnLink = document.querySelector('.signUpBtn-link');
const signInBtnLink = document.querySelector('.signInBtn-link');
const wrapper = document.querySelector('.wrapper');
const loginForm = document.querySelector('.form-wrapper.sign-in form');
const signupForm = document.querySelector('.form-wrapper.sign-up form');

// Toggle between sign-in and sign-up forms
signUpBtnLink.addEventListener('click', (e) => {
    e.preventDefault();
    wrapper.classList.add('active');
});

signInBtnLink.addEventListener('click', (e) => {
    e.preventDefault();
    wrapper.classList.remove('active');
});

// Sign-Up Form Submission
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
        const email = signupForm.elements['email'].value.trim();
        const phoneNumber = signupForm.elements['phonenumber'].value.trim();
        const password = signupForm.elements['password'].value;

        if (!email || !phoneNumber || !password) {
            throw new Error('Please fill in all fields');
        }

        const requestBody = { email, phoneNumber, password };
        console.log("Sign up details:", requestBody);

        const response = await fetch(`${API_BASE_URL}/auth/signup`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Accept': 'application/json' 
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        console.log("Sign-up response:", data);

        if (!response.ok) throw new Error(data.message || 'Registration failed');

        if (data.jwt) {
            showSuccessMessage("Sign up successful! Redirecting to login...");
            setTimeout(() => window.location.href = 'login.html', 1500);
        } else {
            throw new Error(data.message || 'Registration failed');
        }
    } catch (error) {
        showErrorMessage(error);
    }
});

// Sign-In Form Submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
        const email = loginForm.elements['email'].value.trim();
        const password = loginForm.elements['password'].value;

        if (!email || !password) {
            throw new Error('Please enter both email and password');
        }

        const requestBody = { email, password };
        console.log("Login details:", requestBody);

        const response = await fetch(`${API_BASE_URL}/auth/signin`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Accept': 'application/json' 
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        console.log("Sign-in response:", data);

        if (!response.ok) throw new Error(data.message || 'Login failed');

        if (data.jwt) {
            const userData = { email, jwt: data.jwt };
            localStorage.setItem('userData', JSON.stringify(userData));
            showSuccessMessage("Sign in successful! Redirecting...");
            setTimeout(() => window.location.href = 'index.html', 1500);
        } else {
            throw new Error(data.message || 'Login failed');
        }
    } catch (error) {
        showErrorMessage(error);
    }
});

// Display success message
function showSuccessMessage(message) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    errorMessage.className = 'success-message';

    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

// Display error message
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
