const API_URL = "http://localhost:5000/api/auth";

// CUSTOMER REGISTRATION
const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const message = document.getElementById("message");

        try {
            const response = await fetch(`${API_URL}/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    email,
                    password
                })
            });

            const data = await response.json();

            message.textContent = data.message;

            if (data.success) {
                registerForm.reset();
            }

        } catch (error) {
            message.textContent = "Unable to connect to server.";
            console.error(error);
        }
    });
}

// CUSTOMER / STAFF / ADMIN LOGIN
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;
        const message = document.getElementById("loginMessage");

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                sessionStorage.setItem("brightloopToken", data.token);
                sessionStorage.setItem(
                    "brightloopUser",
                    JSON.stringify(data.user)
                );

                message.textContent = `Welcome ${data.user.name}!`;

                // Dashboard pages can be added by the team later.
                if (data.user.role === "CUSTOMER") {
                    window.location.href = "../customer/index.html";
                } else if (data.user.role === "ADMIN") {
                    window.location.href = "../admin/index.html";
                } else if (data.user.role === "STAFF") {
                    window.location.href = "../staff/index.html";
                }

            } else {
                message.textContent = data.message;
            }

        } catch (error) {
            message.textContent = "Unable to connect to server.";
            console.error(error);
        }
    });
}

// FORGOT PASSWORD
const forgotForm = document.getElementById("forgotForm");

if (forgotForm) {
    forgotForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("forgotEmail").value.trim();
        const message = document.getElementById("forgotMessage");

        try {
            const response = await fetch(`${API_URL}/forgot-password`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();
            message.textContent = data.message;

        } catch (error) {
            message.textContent = "Unable to connect to server.";
            console.error(error);
        }
    });
}

// LOGOUT FUNCTION
function logout() {
    sessionStorage.removeItem("brightloopToken");
    sessionStorage.removeItem("brightloopUser");

    window.location.href = "../auth/index.html";
}

// Export logout for use by dashboard pages.
window.logout = logout;