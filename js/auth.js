"use strict";

async function initializeAuthentication() {
    const form = document.getElementById("authForm");
    const message = document.getElementById("authMessage");
    const submit = form.querySelector("button[type=submit]");
    const isRegister = form.dataset.action === "register";

    try {
        const session = await MyPlannerAPI.getSession();
        if (session.authenticated) {
            window.location.replace("MyPlannerPlus.html");
            return;
        }
    } catch (error) {
        message.textContent = error.message;
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        message.textContent = "";
        submit.disabled = true;
        try {
            const fields = {
                email: document.getElementById("email").value.trim(),
                password: document.getElementById("password").value
            };
            if (isRegister) {
                fields.name = document.getElementById("name").value.trim();
            }
            await MyPlannerAPI.authenticate(isRegister ? "register" : "login", fields);
            window.location.replace("MyPlannerPlus.html");
        } catch (error) {
            message.textContent = error.message;
        } finally {
            submit.disabled = false;
        }
    });
}

initializeAuthentication();
