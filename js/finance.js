"use strict";
const FINANCE_COLORS = {
    Food: "#e7a5bb", Housing: "#d5bb83", Transportation: "#a4c4e5",
    School: "#b8a3d8", Shopping: "#9dcdb1", Bills: "#f2c47c", Other: "#aeb7c1"
};
const FINANCE_CATEGORIES = Object.keys(FINANCE_COLORS);
let financePeriod = "week";
let plannerData = { finance: defaultFinance() };
let financeSaveErrorShown = false;
function defaultFinance() { return { startingBalanceCents: 0, budgets: {}, transactions: [] }; }
function normalizeFinance(data) {
    const f = data && typeof data === "object" ? data : {};
    return {
        startingBalanceCents: Number.isSafeInteger(f.startingBalanceCents) && f.startingBalanceCents >= 0 ? f.startingBalanceCents : 0,
        budgets: f.budgets && typeof f.budgets === "object" ? f.budgets : {},
        transactions: Array.isArray(f.transactions) ? f.transactions.filter(t => t &&
            (t.type === "income" || t.type === "expense") && Number.isSafeInteger(t.amountCents) &&
            t.amountCents > 0 && /^\d{4}-\d{2}-\d{2}$/.test(t.date)) : []
    };
}
function reportFinanceSaveError(error) {
    console.error(error);
    if (!financeSaveErrorShown) {
        financeSaveErrorShown = true;
        alert("Could not save to the database: " + error.message);
    }
}
function savePlanner() {
    MyPlannerAPI.saveSection("finance", plannerData.finance).catch(reportFinanceSaveError);
}
function financeMoney(cents) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100); }
function financeCents(value, allowZero = false) {
    const s = String(value).trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(s))
        return null;
    const parts = s.split(".");
    const cents = Number(parts[0]) * 100 + Number((parts[1] || "").padEnd(2, "0"));
    if (!Number.isSafeInteger(cents) || cents > 9999999999)
        return null;
    return allowZero ? (cents >= 0 ? cents : null) : (cents > 0 ? cents : null);
}
function localDateString(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function financeRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let end;
    if (financePeriod === "week") {
        start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
        end = new Date(start);
        end.setDate(end.getDate() + 7);
    }
    else {
        start.setDate(1);
        end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    }
    return { start: localDateString(start), end: localDateString(end), key: financePeriod + ":" + localDateString(start) };
}
function setMessage(message) { document.getElementById("financeMessage").textContent = message; }
function updateCategories() {
    const type = document.getElementById("transactionType");
    const category = document.getElementById("transactionCategory");
    const options = type.value === "income" ? ["Paycheck", "Other income"] : FINANCE_CATEGORIES;
    const prior = category.value;
    category.replaceChildren();
    options.forEach(name => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        category.appendChild(option);
    });
    if (options.includes(prior))
        category.value = prior;
}
function initFinance() {
    document.getElementById("transactionType").addEventListener("change", updateCategories);
    updateCategories();
    document.getElementById("transactionDate").value = localDateString(new Date());
    document.getElementById("financeWeek").addEventListener("click", () => { financePeriod = "week"; renderFinance(); });
    document.getElementById("financeMonth").addEventListener("click", () => { financePeriod = "month"; renderFinance(); });
    document.getElementById("startingBalanceForm").addEventListener("submit", e => {
        e.preventDefault();
        const cents = financeCents(document.getElementById("startingBalance").value, true);
        if (cents === null) {
            alert("Enter a valid starting balance.");
            return;
        }
        plannerData.finance.startingBalanceCents = cents;
        savePlanner();
        renderFinance();
    });
    document.getElementById("budgetForm").addEventListener("submit", e => {
        e.preventDefault();
        const cents = financeCents(document.getElementById("budgetAmount").value, true);
        if (cents === null) {
            alert("Enter a valid budget.");
            return;
        }
        plannerData.finance.budgets[financeRange().key] = cents;
        savePlanner();
        renderFinance();
    });
    document.getElementById("transactionForm").addEventListener("submit", e => {
        e.preventDefault();
        const amount = financeCents(document.getElementById("transactionAmount").value);
        const title = document.getElementById("transactionDescription").value.trim();
        const date = document.getElementById("transactionDate").value;
        if (!amount || !title || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date + "T12:00:00").getTime())) {
            setMessage("Enter a description, valid amount, and date.");
            return;
        }
        plannerData.finance.transactions.push({
            id: window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random(), type: document.getElementById("transactionType").value,
            title: title.slice(0, 100), date, category: document.getElementById("transactionCategory").value, amountCents: amount
        });
        savePlanner();
        e.target.reset();
        document.getElementById("transactionDate").value = localDateString(new Date());
        updateCategories();
        setMessage("Transaction added!");
        renderFinance();
    });
    document.getElementById("transactionList").addEventListener("click", e => {
        const button = e.target.closest("button[data-transaction-id]");
        if (!button)
            return;
        if (!confirm("Delete this transaction?"))
            return;
        plannerData.finance.transactions = plannerData.finance.transactions.filter(t => String(t.id) !== button.dataset.transactionId);
        savePlanner();
        renderFinance();
    });
    renderFinance();
}
function renderFinance() {
    const range = financeRange();
    const finance = plannerData.finance;
    const entries = finance.transactions.filter(t => t.date >= range.start && t.date < range.end);
    const income = entries.filter(t => t.type === "income").reduce((n, t) => n + t.amountCents, 0);
    const expenses = entries.filter(t => t.type === "expense").reduce((n, t) => n + t.amountCents, 0);
    const balance = finance.startingBalanceCents + finance.transactions.reduce((n, t) => n + (t.type === "income" ? t.amountCents : -t.amountCents),
    0);
    const hasBudget = Object.prototype.hasOwnProperty.call(finance.budgets, range.key);
    const budget = hasBudget ? Number(finance.budgets[range.key]) : 0;
    document.getElementById("financeBalance").textContent = financeMoney(balance);
    document.getElementById("financeIncome").textContent = financeMoney(income);
    document.getElementById("financeSpent").textContent = financeMoney(expenses);
    const remainingElement = document.getElementById("financeRemaining");
    remainingElement.textContent = hasBudget ? financeMoney(budget - expenses) : "Not set";
    remainingElement.classList.toggle("finance-negative", hasBudget && budget - expenses < 0);
    document.getElementById("financeBudgetHint").textContent = hasBudget ? (expenses > budget ? "Over budget" : "Available to spend") : "Set a budget to get started";
    document.getElementById("financePeriodLabel").textContent = financePeriod === "week" ? "Weekly spending limit" : "Monthly spending limit";
    document.getElementById("financeWeek").classList.toggle("active", financePeriod === "week");
    document.getElementById("financeMonth").classList.toggle("active", financePeriod === "month");
    document.getElementById("budgetAmount").value = hasBudget ? (budget / 100).toFixed(2) : "";
    document.getElementById("startingBalance").value = (finance.startingBalanceCents / 100).toFixed(2);
    document.getElementById("financePeriodDate").textContent = financePeriod === "week" ? "Week of " + range.start : "Month of " + new Date(range.start + "T12:00:00").toLocaleDateString("en-US",
    {
        month: "long", year: "numeric"
    });
    const percent = hasBudget ? (budget === 0 ? (expenses > 0 ? 100 : 0) : Math.min(100, Math.round(expenses / budget * 100))) : 0;
    document.getElementById("budgetProgress").setAttribute("aria-valuenow", String(percent));
    const fill = document.getElementById("budgetProgressFill");
    fill.style.width = percent + "%";
    fill.style.background = hasBudget && expenses > budget ? "#c85c6e" : "#83b99b";
    document.getElementById("budgetSummary").textContent = hasBudget ? financeMoney(expenses) + " spent of " + financeMoney(budget) + " budget" + (expenses > budget ? " · Over budget!" : "") : "Set a weekly or monthly spending limit.";
    const totals = {};
    entries.filter(t => t.type === "expense").forEach(t => { totals[t.category] = (totals[t.category] || 0) + t.amountCents; });
    const groups = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const donut = document.getElementById("financeDonut");
    const legend = document.getElementById("financeLegend");
    legend.replaceChildren();
    document.getElementById("financeDonutTotal").textContent = financeMoney(expenses);
    if (expenses === 0) {
        donut.style.background = "conic-gradient(#eee6dc 0% 100%)";
        donut.setAttribute("aria-label", "No expenses for this period");
        const p = document.createElement("p");
        p.className = "finance-muted";
        p.textContent = "Add an expense to see your breakdown.";
        legend.appendChild(p);
    }
    else {
        let pos = 0;
        const stops = [];
        groups.forEach(([name, cents]) => {
            const next = pos + cents / expenses * 100;
            const color = FINANCE_COLORS[name] || FINANCE_COLORS.Other;
            stops.push(color + " " + pos + "% " + next + "%");
            pos = next;
            const item = document.createElement("div");
            item.className = "finance-legend-item";
            const dot = document.createElement("i");
            dot.style.background = color;
            const label = document.createElement("span");
            label.textContent = name + " · " + (cents / expenses * 100).toFixed(0) + "%";
            const money = document.createElement("strong");
            money.textContent = financeMoney(cents);
            item.append(dot, label, money);
            legend.appendChild(item);
        });
        donut.style.background = "conic-gradient(" + stops.join(",") + ")";
        donut.setAttribute("aria-label", groups.map(([name, cents]) => name + " " + financeMoney(cents)).join(", "));
    }
    const list = document.getElementById("transactionList");
    list.replaceChildren();
    document.getElementById("transactionCount").textContent = entries.length + " " + (entries.length === 1 ? "entry" : "entries");
    if (!entries.length) {
        const p = document.createElement("p");
        p.className = "finance-muted finance-empty";
        p.textContent = "No transactions in this period yet.";
        list.appendChild(p);
    }
    [...entries].sort((a, b) => b.date.localeCompare(a.date)).forEach(t => {
        const item = document.createElement("div");
        item.className = "finance-transaction";
        const info = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = t.title;
        const meta = document.createElement("small");
        meta.textContent = t.category + " · " + t.date;
        info.append(title, meta);
        const value = document.createElement("span");
        value.className = t.type === "income" ? "finance-plus" : "finance-minus";
        value.textContent = (t.type === "income" ? "+" : "−") + financeMoney(t.amountCents);
        const del = document.createElement("button");
        del.type = "button";
        del.dataset.transactionId = t.id;
        del.textContent = "×";
        del.setAttribute("aria-label", "Delete " + t.title);
        item.append(info, value, del);
        list.appendChild(item);
    });
}
async function loadBills() {
    const result = await MyPlannerAPI.bills();
    renderBills(result.bills);
}
function renderBills(bills) {
    const list = document.getElementById("billList");
    list.replaceChildren();
    if (!bills.length) {
        const empty = document.createElement("p");
        empty.className = "finance-muted";
        empty.textContent = "No bills added yet.";
        list.appendChild(empty);
        return;
    }
    bills.forEach(bill => {
        const item = document.createElement("div");
        item.className = "finance-transaction bill-row";
        const info = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = bill.name;
        const details = document.createElement("small");
        details.textContent = (bill.due_date || "No due date") + " · " +
            (bill.paid ? "Paid" : "Unpaid") + " · " + financeMoney(bill.amountCents);
        info.append(name, details);
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.textContent = bill.paid ? "Mark unpaid" : "Mark paid";
        toggle.addEventListener("click", async () => {
            toggle.disabled = true;
            try {
                await MyPlannerAPI.bills({ action: "update", bill_id: bill.bill_id, name: bill.name,
                    amountCents: bill.amountCents, due_date: bill.due_date, paid: !bill.paid });
                await loadBills();
            } catch (error) {
                alert("Could not update bill: " + error.message);
                toggle.disabled = false;
            }
        });
        const del = document.createElement("button");
        del.type = "button";
        del.textContent = "×";
        del.setAttribute("aria-label", "Delete bill " + bill.name);
        del.addEventListener("click", async () => {
            if (!confirm("Delete bill " + bill.name + "?")) return;
            del.disabled = true;
            try {
                await MyPlannerAPI.bills({ action: "delete", bill_id: bill.bill_id });
                await loadBills();
            } catch (error) {
                alert("Could not delete bill: " + error.message);
                del.disabled = false;
            }
        });
        item.append(info, toggle, del);
        list.appendChild(item);
    });
}
function initBills() {
    const form = document.getElementById("billForm");
    form.addEventListener("submit", async event => {
        event.preventDefault();
        const name = document.getElementById("billName").value.trim();
        const amount = financeCents(document.getElementById("billAmount").value, true);
        const date = document.getElementById("billDueDate").value;
        const message = document.getElementById("billMessage");
        if (!name || amount === null) {
            message.textContent = "Enter a valid name and amount.";
            return;
        }
        const saveButton = form.querySelector("button[type=submit]");
        saveButton.disabled = true;
        try {
            await MyPlannerAPI.bills({ action: "create", name,
                amountCents: amount, due_date: date || null, paid: false });
            await loadBills();
            form.reset();
            message.textContent = "Bill saved!";
        } catch (error) {
            message.textContent = "Could not save bill: " + error.message;
        } finally {
            saveButton.disabled = false;
        }
    });
    loadBills().catch(error => {
        document.getElementById("billMessage").textContent = error.message;
    });
}
async function initializeFinance() {
    try {
        await MyPlannerAPI.requireSession();
        const state = await MyPlannerAPI.getState();
        plannerData.finance = normalizeFinance(state.finance);
        initFinance();
        initBills();
    } catch (error) {
        console.error(error);
        if (error.message !== "Please log in.") {
            alert("Unable to load finance data from the database: " + error.message);
        }
    }
}
document.querySelector('.back-link[href="MyPlannerPlus.html"]').addEventListener("click", async event => {
    event.preventDefault();
    try {
        await MyPlannerAPI.flushSaves();
        window.location.href = "MyPlannerPlus.html";
    } catch (error) {
        reportFinanceSaveError(error);
    }
});
document.getElementById("logoutButton").addEventListener("click", () => {
    MyPlannerAPI.logout().catch(reportFinanceSaveError);
});
initializeFinance();
