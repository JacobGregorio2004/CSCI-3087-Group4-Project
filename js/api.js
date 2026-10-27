"use strict";

// Shared, same-origin PHP API client. Data is stored on the server, not in localStorage.
const MyPlannerAPI = (() => {
    let securityToken = null;
    let saveQueue = Promise.resolve();

    async function request(path, method = "GET", data = null) {
        const options = { method, credentials: "same-origin", headers: {} };
        if (data !== null) {
            options.headers["Content-Type"] = "application/json";
            options.headers["X-CSRF-Token"] = securityToken || "";
            options.body = JSON.stringify(data);
        }
        const response = await fetch(path, options);
        let result;
        try {
            result = await response.json();
        } catch (error) {
            throw new Error("The server did not return JSON. Make sure PHP is enabled on your host.");
        }
        if (!response.ok) {
            if (response.status === 401 && path !== "api/auth.php") {
                window.location.href = "login.html";
            }
            throw new Error(result.error || "Server request failed.");
        }
        return result;
    }

    async function getSession() {
        const result = await request("api/auth.php");
        securityToken = result.csrfToken;
        return result;
    }

    async function requireSession() {
        const session = await getSession();
        if (!session.authenticated) {
            window.location.replace("login.html");
            throw new Error("Please log in.");
        }
        return session.user;
    }

    async function authenticate(action, fields) {
        if (!securityToken) {
            await getSession();
        }
        const result = await request("api/auth.php", "POST", { action, ...fields });
        securityToken = result.csrfToken;
        return result;
    }

    async function getState() {
        const result = await request("api/state.php");
        return result.state;
    }

    function saveSection(section, data) {
        // Snapshot at the time the Save action happens so later edits do not mutate it.
        const snapshot = JSON.parse(JSON.stringify({ section, data }));
        saveQueue = saveQueue.catch(() => {}).then(() => request("api/state.php", "POST", snapshot));
        return saveQueue;
    }

    async function bills(data = null) {
        return data === null ? request("api/bills.php") : request("api/bills.php", "POST", data);
    }

    async function flushSaves() {
        await saveQueue;
    }

    async function logout() {
        await flushSaves();
        await request("api/auth.php", "POST", { action: "logout" });
        window.location.replace("login.html");
    }

    return { getSession, requireSession, authenticate, getState, saveSection, flushSaves, bills, logout };
})();
