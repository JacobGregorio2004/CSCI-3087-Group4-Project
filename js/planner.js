(() => {
    // Shortcut: $("elementId") finds an HTML element by its unique id. This is the same as document.getElementById("elementId").
    const $ = id => document.getElementById(id);

    // STATE: These variables remember which month, date, and calendar tab the user is viewing. const means the variable cannot be reassigned; let means it can change.
    const today = new Date();
    let viewYear = today.getFullYear();
    let viewMonth = today.getMonth();
    let selectedDate = toISODate(today);
    let activeCategory = "creative";

    // DATA: Arrays ([]) hold the user-created calendars, calendar events, and to-do tasks. Each entry is an object containing properties such as id, title, and date.
    let customCategories = [];
    let events = [];
    let tasks = [];
    let editingEventId = null;
    let boardBackground = "#fffdf8";

    // DATABASE SAFETY: Do not save until the existing account data has finished loading. The error flag prevents repeated alerts.
    let readyToSave = false;
    let saveErrorShown = false;
    
    // Show a database error in the developer console and alert the user once.
    function reportSaveError(error) {
        console.error("Could not save MyPlanner+ data:", error);
        if (!saveErrorShown) {
            saveErrorShown = true;
            alert("Your changes could not be saved to the database. " + error.message);
        }
    }
    // Save events, tasks, and custom calendar categories to the "planner" section of the database. .catch(...) handles a failed asynchronous save.
    function save() {
        if (!readyToSave) return;
        MyPlannerAPI.saveSection("planner", { events, tasks, customCategories })
            .catch(reportSaveError);
    }
    // Convert a JavaScript Date to YYYY-MM-DD (for example 2026-11-16). padStart adds leading zeros to single-digit months and days.
    function toISODate(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }
    // Convert a YYYY-MM-DD string back to a JavaScript Date. Months start at 0 in JavaScript; noon helps avoid date/timezone edge cases.
    function fromISODate(value) {
        const [y, m, d] = value.split("-").map(Number);
        return new Date(y, m - 1, d, 12);
    }
    // Turn a stored date into a readable date such as Monday, November 16, 2026.
    function prettyDate(value) {
        return fromISODate(value).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    }
    // Find the displayed calendar name: check custom calendars first, then the built-in calendar names.
    function categoryName(category) {
        return customCategories.find(c => c.key === category)?.name ||
            ({ work: "Work", school: "School", home: "Home", all: "All", creative: "Creative" }[category] || category);
    }
    // Return only events on the selected date that belong to the current tab (or should be visible across tabs). filter() creates a matching subset.
    function visibleEvents() {
        return events.filter(e => e.date === selectedDate &&
            (activeCategory === "all" || activeCategory === "creative" || e.category === "all" || e.category === activeCategory));
    }
    // CALENDAR DISPLAY: Rebuild the monthly calendar in HTML. "render" means updating what the user sees, not saving data.
    function renderCalendar() {
        $("monthHeading").textContent = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
        const grid = $("calendarGrid");
        grid.innerHTML = "";
        const first = new Date(viewYear, viewMonth, 1);
        const mondayOffset = (first.getDay() + 6) % 7;
        const start = new Date(viewYear, viewMonth, 1 - mondayOffset);
        const todayISO = toISODate(new Date());
        // A six-week calendar grid has 42 cells (6 rows × 7 days).
        for (let i = 0; i < 42; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            const iso = toISODate(date);
            // createElement makes a new HTML element; appendChild inserts it into the page.
            const cell = document.createElement("div");
            cell.className = "day" + (date.getMonth() !== viewMonth ? " outside" : "") + (iso === todayISO ? " today" : "");
            cell.tabIndex = 0;
            cell.setAttribute("role", "button");
            cell.setAttribute("aria-label", prettyDate(iso) + ". Select date to view or add events.");
            const number = document.createElement("div");
            number.className = "day-number";
            number.textContent = date.getDate();
            cell.appendChild(number);
            const decorations = calendarDecorations[iso] || [];
            if (decorations.length) {
                const decoWrap = document.createElement("div");
                decoWrap.className = "day-decorations";
                decoWrap.setAttribute("aria-label", decorations.length + " calendar stickers");
                decorations.slice(0, 4).forEach(sticker => {
                    if (sticker.type === "photo") {
                        const img = document.createElement("img");
                        img.className = "calendar-deco-photo";
                        img.style.width = `${Math.round(25 * Math.min(2, Math.max(0.5, Number(sticker.size) || 1)))}px`;
                        img.style.height = img.style.width;
                        img.src = sticker.src;
                        img.alt = "Photo sticker";
                        decoWrap.appendChild(img);
                    }
                    else {
                        const deco = document.createElement("span");
                        deco.className = "calendar-deco-emoji";
                        deco.style.fontSize = `${Math.round(15 * Math.min(2, Math.max(0.5, Number(sticker.size) || 1)))}px`;
                        deco.textContent = sticker.emoji;
                        decoWrap.appendChild(deco);
                    }
                });
                if (decorations.length > 4) {
                    const more = document.createElement("small");
                    more.textContent = "+" + (decorations.length - 4);
                    decoWrap.appendChild(more);
                }
                cell.appendChild(decoWrap);
            }
            // Display up to three event labels inside each calendar day cell.
            const dayEvents = events.filter(e => e.date === iso && (activeCategory === "all" || activeCategory === "creative" || e.category === "all" || e.category === activeCategory));
            dayEvents.slice(0, 3).forEach(e => {
                const chip = document.createElement("span");
                chip.className = "event-chip " + e.category;
                chip.textContent = (e.time ? e.time + " " : "") + e.title;
                cell.appendChild(chip);
            });
            if (dayEvents.length > 3) {
                const more = document.createElement("small");
                more.textContent = `+${dayEvents.length - 3} more`;
                cell.appendChild(more);
            }
            // A shared function supports both mouse clicks and Enter/Space keyboard selection.
            const selectDay = () => { selectedDate = iso; if (date.getMonth() !== viewMonth) {
                viewMonth = date.getMonth();
                viewYear = date.getFullYear();
            } renderCalendar(); renderDayDetails(); renderCalendarStickerPreview(); };
            cell.addEventListener("click", selectDay);
            cell.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                selectDay();
            } });
            if (iso === selectedDate) {
                cell.style.boxShadow = "inset 0 0 0 3px #d9b37c";
            }
            grid.appendChild(cell);
        }
    }
    // SELECTED-DAY EVENTS: Display the events for the chosen date, with Edit and Delete buttons.
    function renderDayDetails() {
        $("selectedDateTitle").textContent = prettyDate(selectedDate);
        const list = $("eventList");
        list.innerHTML = "";
        const dayEvents = visibleEvents().sort((a, b) => (a.time || "").localeCompare(b.time || ""));
        if (!dayEvents.length) {
            const empty = document.createElement("p");
            empty.className = "empty-note";
            empty.textContent = "No events for this date yet. Add one to get started!";
            list.appendChild(empty);
        }
        dayEvents.forEach(event => {
            const row = document.createElement("div");
            row.className = "event-row";
            const info = document.createElement("div");
            const title = document.createElement("strong");
            title.textContent = event.title;
            info.appendChild(title);
            const meta = document.createElement("small");
            meta.textContent = (event.time ? event.time + " · " : "") + categoryName(event.category);
            info.appendChild(meta);
            const edit = document.createElement("button");
            edit.type = "button";
            edit.className = "secondary-button";
            edit.textContent = "Edit";
            edit.addEventListener("click", () => openEventEditor(event));
            const del = document.createElement("button");
            del.className = "delete-button";
            del.type = "button";
            del.textContent = "×";
            del.title = "Delete event";
            del.setAttribute("aria-label", "Delete " + event.title);
            del.addEventListener("click", () => {
                events = events.filter(e => e.id !== event.id);
                save();
                renderCalendar();
                renderDayDetails();
            });
            row.append(info, edit, del);
            list.appendChild(row);
        });
        renderTasks();
        renderWorkWeekTasks();
    }
    // Find the Monday and Sunday surrounding a selected date, for the weekly list.
    function getWeekRange(dateISO) {
        const date = fromISODate(dateISO);
        const mondayOffset = (date.getDay() + 6) % 7;
        const monday = new Date(date);
        monday.setDate(date.getDate() - mondayOffset);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return { monday, sunday, start: toISODate(monday), end: toISODate(sunday) };
    }
    // WEEKLY EVENT CHECKLIST: Show events for the entire Monday-Sunday week, sorted by date/time, with completion checkboxes and Edit buttons.
    function renderWorkWeekTasks() {
        const range = getWeekRange(selectedDate);
        const fmt = d => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        $("workWeekRange").textContent = `${fmt(range.monday)} – ${fmt(range.sunday)}`;
        const list = $("workWeekTodoList");
        list.innerHTML = "";
        const weekEvents = events
            .filter(event => event.date >= range.start && event.date <= range.end)
            .sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""));
        if (!weekEvents.length) {
            const empty = document.createElement("p");
            empty.className = "empty-note";
            empty.textContent = "No events added for this week yet. Add a calendar event and it will appear here automatically.";
            list.appendChild(empty);
            return;
        }
        weekEvents.forEach(event => {
            const row = document.createElement("div");
            row.className = "todo-item" + (event.weekTaskDone ? " done" : "");
            const label = document.createElement("label");
            // A checkbox changes the stored completed state when the user clicks it.
            const check = document.createElement("input");
            check.type = "checkbox";
            check.checked = !!event.weekTaskDone;
            check.addEventListener("change", () => {
                event.weekTaskDone = check.checked;
                save();
                renderWorkWeekTasks();
            });
            const span = document.createElement("span");
            span.textContent = `${fromISODate(event.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}${event.time ? " · " + event.time : ""} — ${categoryName(event.category)}: ${event.title}`;
            label.append(check, span);
            const jump = document.createElement("button");
            jump.type = "button";
            jump.className = "secondary-button";
            jump.textContent = "Edit";
            jump.title = "Edit this event";
            jump.addEventListener("click", () => {
                selectedDate = event.date;
                const d = fromISODate(event.date);
                viewYear = d.getFullYear();
                viewMonth = d.getMonth();
                renderCalendar();
                renderDayDetails();
                openEventEditor(event);
            });
            row.append(label, jump);
            list.appendChild(row);
        });
    }
    // TO-DO LIST: Show tasks matching the selected date and calendar. Users can check off, edit, or delete tasks.
    function renderTasks() {
        const list = $("todoList");
        list.innerHTML = "";
        const shown = tasks.filter(t => (!t.date || t.date === selectedDate) && (activeCategory === "all" || activeCategory === "creative" || t.category === "all" || t.category === activeCategory));
        if (!shown.length) {
            const empty = document.createElement("p");
            empty.className = "empty-note";
            empty.textContent = "No tasks yet. Add your first task above.";
            list.appendChild(empty);
        }
        shown.forEach(task => {
            const row = document.createElement("div");
            row.className = "todo-item" + (task.done ? " done" : "");
            const label = document.createElement("label");
            // A checkbox changes the stored completed state when the user clicks it.
            const check = document.createElement("input");
            check.type = "checkbox";
            check.checked = task.done;
            check.addEventListener("change", () => { task.done = check.checked; save(); renderTasks(); });
            const span = document.createElement("span");
            span.textContent = task.text;
            label.append(check, span);
            const del = document.createElement("button");
            del.type = "button";
            del.className = "delete-button";
            del.textContent = "×";
            del.title = "Delete task";
            del.setAttribute("aria-label", "Delete task " + task.text);
            del.addEventListener("click", () => { tasks = tasks.filter(t => t.id !== task.id); save(); renderTasks(); });
            const edit = document.createElement("button");
            edit.type = "button";
            edit.className = "secondary-button";
            edit.textContent = "Edit";
            edit.addEventListener("click", () => {
                const updated = prompt("Edit task", task.text);
                if (updated === null) return;
                if (!updated.trim()) { alert("Task cannot be empty."); return; }
                task.text = updated.trim().slice(0, 160);
                save(); renderTasks();
            });
            row.append(label, edit, del);
            list.appendChild(row);
        });
    }
    // TAB NAVIGATION: Change the active calendar and switch between the calendar view and Creative Mood Board view.
    function activateCategory(category, button) {
        activeCategory = category;
        document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab === button));
        $("creativePage").classList.toggle("hidden", category !== "creative");
        $("calendarPage").classList.toggle("hidden", category === "creative");
        if (category !== "creative") {
            $("calendarTitle").textContent = categoryName(category) + " Calendar";
            renderCalendar();
            renderDayDetails();
        }
    }
    // EVENT LISTENER: When a calendar tab is clicked, read its data-category HTML attribute and activate that tab. Event delegation also supports newly created tabs.
    $("tabs").addEventListener("click", e => {
        const button = e.target.closest("button.tab[data-category]");
        if (button)
            activateCategory(button.dataset.category, button);
    });
    // MONTH BUTTONS: Move to the previous month, adjusting the year if needed.
    $("prevMonth").addEventListener("click", () => { viewMonth--; if (viewMonth < 0) {
        viewMonth = 11;
        viewYear--;
    } renderCalendar(); });
    // Move to the next month, adjusting the year if needed.
    $("nextMonth").addEventListener("click", () => { viewMonth++; if (viewMonth > 11) {
        viewMonth = 0;
        viewYear++;
    } renderCalendar(); });
    // TODAY BUTTON: Return the calendar to today and refresh the selected-day information.
    $("todayBtn").addEventListener("click", () => {
        const now = new Date();
        viewYear = now.getFullYear();
        viewMonth = now.getMonth();
        selectedDate = toISODate(now);
        renderCalendar();
        renderDayDetails();
        renderCalendarStickerPreview();
    });
    // SHOW/HIDE DETAILS: Toggle the hidden CSS class; aria-expanded tells assistive technology whether the panel is open.
    $("toggleCalendarDetails").addEventListener("click", () => {
        const details = $("calendarDetails");
        const opening = details.classList.contains("hidden");
        details.classList.toggle("hidden", !opening);
        $("toggleCalendarDetails").setAttribute("aria-expanded", String(opening));
        $("toggleCalendarDetails").textContent = opening ? "✏️ Hide planner details" : "✏️ Show planner details";
    });
    // CALENDAR STICKERS: This object groups emoji/photo stickers by date, such as calendarDecorations["2026-11-16"].
    let calendarDecorations = {};
    // Save the calendar-day sticker data separately from the main events and tasks.
    function saveCalendarDecorations() {
        if (!readyToSave) return;
        MyPlannerAPI.saveSection("calendarDecorations", calendarDecorations)
            .catch(reportSaveError);
    }
    // STICKER PREVIEW: Display the selected day’s stickers, size sliders, and Remove buttons.
    function renderCalendarStickerPreview() {
        const preview = $("calendarStickerPreview");
        preview.innerHTML = "";
        $("creativeStickerDate").textContent = "Decorating: " + prettyDate(selectedDate);
        const stickers = calendarDecorations[selectedDate] || [];
        if (!stickers.length) {
            const empty = document.createElement("span");
            empty.className = "mini-board-empty";
            empty.textContent = "No stickers on this date yet. Add one above!";
            preview.appendChild(empty);
            return;
        }
        stickers.forEach((sticker, index) => {
            const wrapper = document.createElement("div");
            wrapper.className = "calendar-sticker-item";
            const visual = document.createElement(sticker.type === "photo" ? "img" : "span");
            const size = Math.min(2, Math.max(0.5, Number(sticker.size) || 1));
            if (sticker.type === "photo") {
                visual.className = "calendar-deco-photo";
                visual.src = sticker.src;
                visual.alt = "Uploaded calendar photo sticker";
                visual.style.width = `${Math.round(44 * size)}px`;
                visual.style.height = `${Math.round(44 * size)}px`;
            } else {
                visual.className = "calendar-deco-emoji";
                visual.textContent = sticker.emoji;
                visual.style.fontSize = `${Math.round(26 * size)}px`;
            }
            const label = document.createElement("label");
            label.className = "calendar-sticker-size-label";
            label.textContent = "Size";
            // A range input lets the user resize a sticker between 50% and 200%.
            const slider = document.createElement("input");
            slider.type = "range";
            slider.min = "50";
            slider.max = "200";
            slider.step = "10";
            slider.value = String(Math.round(size * 100));
            slider.setAttribute("aria-label", `Resize calendar sticker ${index + 1}`);
            slider.addEventListener("input", () => {
                sticker.size = Number(slider.value) / 100;
                if (sticker.type === "photo") {
                    visual.style.width = `${Math.round(44 * sticker.size)}px`;
                    visual.style.height = visual.style.width;
                } else {
                    visual.style.fontSize = `${Math.round(26 * sticker.size)}px`;
                }
                // Save only on change, so dragging the slider does not flood the API.
            });
            slider.addEventListener("change", () => {
                saveCalendarDecorations();
                renderCalendar();
            });
            label.appendChild(slider);
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "calendar-sticker-remove";
            remove.textContent = "Remove";
            remove.setAttribute("aria-label", `Remove calendar sticker ${index + 1}`);
            remove.addEventListener("click", () => {
                calendarDecorations[selectedDate].splice(index, 1);
                if (!calendarDecorations[selectedDate].length) delete calendarDecorations[selectedDate];
                saveCalendarDecorations();
                renderCalendar();
                renderCalendarStickerPreview();
            });
            wrapper.append(visual, label, remove);
            preview.appendChild(wrapper);
        });
    }

    // Add an emoji sticker to the selected calendar date, save it, and redraw the calendar and preview.
    function addCalendarEmoji(emoji) {
        if (!calendarDecorations[selectedDate])
            calendarDecorations[selectedDate] = [];
        calendarDecorations[selectedDate].push({ type: "emoji", emoji });
        saveCalendarDecorations();
        renderCalendar();
        renderCalendarStickerPreview();
    }
    // Connect every HTML button with data-calendar-sticker to the addCalendarEmoji function. querySelectorAll finds all matching elements.
    document.querySelectorAll("[data-calendar-sticker]").forEach(button => button.addEventListener("click", () => addCalendarEmoji(button.dataset.calendarSticker)));
    // PHOTO STICKER UPLOAD: Validate an image, read it, resize it using an off-screen canvas, and save it to the selected date.
    $("calendarStickerUpload").addEventListener("change", e => {
        const file = e.target.files && e.target.files[0];
        if (!file)
            return;
        if (!file.type.startsWith("image/")) {
            alert("Please choose an image file.");
            e.target.value = "";
            return;
        }
        const reader = new FileReader();
        reader.onerror = () => { alert("That photo could not be read. Please try another image."); e.target.value = ""; };
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => { alert("That image could not be opened. Please try another photo."); e.target.value = ""; };
            img.onload = () => {
                const max = 180, scale = Math.min(1, max / Math.max(img.width, img.height));
                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const stickerSrc = canvas.toDataURL("image/jpeg", 0.78);
                if (!calendarDecorations[selectedDate])
                    calendarDecorations[selectedDate] = [];
                calendarDecorations[selectedDate].push({ type: "photo", src: stickerSrc });
                saveCalendarDecorations();
                renderCalendar();
                renderCalendarStickerPreview();
                e.target.value = "";
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
    // CLEAR DAY STICKERS: Ask for confirmation before deleting all stickers on the selected date.
    $("clearCalendarStickers").addEventListener("click", () => {
        if (!calendarDecorations[selectedDate] || !calendarDecorations[selectedDate].length)
            return;
        if (confirm("Remove all stickers from " + prettyDate(selectedDate) + "?")) {
            delete calendarDecorations[selectedDate];
            saveCalendarDecorations();
            renderCalendar();
            renderCalendarStickerPreview();
        }
    });
    renderCalendarStickerPreview();
    // EVENT EDITOR: Fill the modal dialog with an existing event’s information so the user can update it.
    function openEventEditor(event) {
        editingEventId = event.id;
        $("eventModalTitle").textContent = "Edit calendar event";
        $("eventName").value = event.title;
        $("eventDate").value = event.date;
        $("eventTime").value = event.time || "";
        $("eventModal").classList.add("open");
        $("eventName").focus();
    }
    // ADD EVENT: Open a blank event form, defaulting its date to the selected calendar day.
    $("addEventBtn").addEventListener("click", () => {
        editingEventId = null;
        $("eventModalTitle").textContent = "Add calendar event";
        $("eventForm").reset();
        $("eventDate").value = selectedDate;
        $("eventModal").classList.add("open");
        $("eventName").focus();
    });
    // CANCEL EVENT: Close the event popup without submitting changes.
    $("cancelEvent").addEventListener("click", () => $("eventModal").classList.remove("open"));
    // SAVE EVENT: preventDefault stops the browser from reloading. Update an existing event or create a new event with a unique id.
    $("eventForm").addEventListener("submit", e => {
        e.preventDefault();
        const title = $("eventName").value.trim();
        const date = $("eventDate").value;
        if (!title || !date)
            return;
        if (editingEventId) {
            const existing = events.find(item => item.id === editingEventId);
            if (existing) Object.assign(existing, { title, date, time: $("eventTime").value });
        } else {
            events.push({
                id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
                title, date, time: $("eventTime").value,
                category: activeCategory === "creative" ? "all" : activeCategory
            });
        }
        editingEventId = null;
        selectedDate = date;
        const d = fromISODate(date);
        viewYear = d.getFullYear();
        viewMonth = d.getMonth();
        save();
        $("eventModal").classList.remove("open");
        $("eventForm").reset();
        renderCalendar();
        renderDayDetails();
        renderCalendarStickerPreview();
    });
    // ADD TO-DO: Read the task text, create a new unchecked task, save it, and refresh the task list.
    $("todoForm").addEventListener("submit", e => {
        e.preventDefault();
        const input = $("todoInput");
        const text = input.value.trim();
        if (!text)
            return;
        const category = activeCategory === "creative" ? "all" : activeCategory;
        tasks.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()), text, category, date: selectedDate, done: false });
        input.value = "";
        save();
        renderTasks();
    });
    // CUSTOM CALENDARS: At most 10 Work/School/Home plus user-created calendars; All and Creative are excluded from this count.
    const MAX_CALENDARS = 10;
    // Build a new custom calendar tab in HTML, including its delete (×) button and confirmation dialog.
    function addCustomTab(category) {
        const wrapper = document.createElement("span");
        wrapper.className = "custom-tab-wrap";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "tab";
        button.dataset.category = category.key;
        button.textContent = "📁 " + category.name;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "remove-calendar";
        remove.textContent = "×";
        remove.setAttribute("aria-label", "Delete " + category.name + " calendar");
        remove.addEventListener("click", () => {
            if (!confirm(`Delete ${category.name} calendar and all its events and tasks? This cannot be undone.`)) return;
            customCategories = customCategories.filter(item => item.key !== category.key);
            events = events.filter(item => item.category !== category.key);
            tasks = tasks.filter(item => item.category !== category.key);
            wrapper.remove();
            save();
            if (activeCategory === category.key) activateCategory("all", document.querySelector('[data-category="all"]'));
            else { renderCalendar(); renderDayDetails(); }
        });
        wrapper.append(button, remove);
        $("tabs").insertBefore(wrapper, $("addFolderBtn"));
        return button;
    }
    // ADD CALENDAR BUTTON: Enforce the 10-calendar limit before opening the name-entry popup.
    $("addFolderBtn").addEventListener("click", () => {
        if (customCategories.length + 3 >= MAX_CALENDARS) {
            alert("You can have up to 10 calendars (including Work, School, and Home).");
            return;
        }
        $("folderModal").classList.add("open"); $("folderName").focus();
    });
    // CANCEL FOLDER: Close the new-calendar popup.
    $("cancelFolder").addEventListener("click", () => $("folderModal").classList.remove("open"));
    // CREATE CALENDAR: Check the limit/name, assign a custom key, save it, and switch to the new tab.
    $("folderForm").addEventListener("submit", e => {
        e.preventDefault();
        if (customCategories.length + 3 >= MAX_CALENDARS) {
            alert("You can have up to 10 calendars."); return;
        }
        const name = $("folderName").value.trim();
        if (!name)
            return;
        if ([...document.querySelectorAll(".tab")].some(t => t.textContent.trim().toLowerCase() === name.toLowerCase())) {
            alert("A folder with that name already exists.");
            return;
        }
        const key = "custom_" + Date.now();
        customCategories.push({ key, name });
        save();
        const button = addCustomTab({key, name});
        $("folderName").value = "";
        $("folderModal").classList.remove("open");
        activateCategory(key, button);
    });
    // MODAL SHORTCUTS: Clicking the dark area outside either popup closes it.
    ["eventModal", "folderModal"].forEach(id => $(id).addEventListener("click", e => { if (e.target.id === id)
        $(id).classList.remove("open"); }));
    // ESCAPE SHORTCUT: Press Escape to close any open modal.
    document.addEventListener("keydown", e => { if (e.key === "Escape")
        document.querySelectorAll(".modal.open").forEach(m => m.classList.remove("open")); });
    // Mood board sticker state and drag/drop interactions.
    // MOOD BOARD STATE: Stickers are stored as objects. draggedSticker tracks drag/drop; selectedStickerId tracks the currently selected sticker.
    let boardStickers = [];
    let draggedSticker = null;
    let selectedStickerId = null;
    // HTML CONNECTION: The id="moodBoard" div is the board container. CSS .mood-board styles it; JavaScript adds movable .board-sticker elements inside it.
    const board = $("moodBoard");
    let boardSaveTimer = null;
    // Save the selected mood-board background color to the boardSettings database section.
    function saveBoardBackground() {
        if (readyToSave) MyPlannerAPI.saveSection("boardSettings", { background: boardBackground }).catch(reportSaveError);
    }
    // Save the mood-board stickers after a 300 ms delay (debouncing) to reduce database requests during typing or dragging.
    function boardSave() {
        if (!readyToSave) return;
        // Debounce typing in notes so each keystroke does not cause a database write.
        clearTimeout(boardSaveTimer);
        boardSaveTimer = setTimeout(() => {
            MyPlannerAPI.saveSection("board", boardStickers).catch(reportSaveError);
        }, 300);
    }
    // DRAW MOOD BOARD: Remove old sticker elements and recreate them from boardStickers. Show id="boardEmpty" only when there are no stickers.
    function boardRender() {
        board.querySelectorAll(".board-sticker").forEach(el => el.remove());
        $("boardEmpty").style.display = boardStickers.length ? "none" : "flex";
        boardStickers.forEach(sticker => {
            const item = document.createElement("div");
            item.className = "board-sticker" + (sticker.type === "note" ? " note " + (sticker.noteType || "") : sticker.type === "photo" ? " photo-sticker" : "") + (selectedStickerId === sticker.id ? " selected" : "");
            item.dataset.id = sticker.id;
            item.style.left = `${Math.max(0, Math.min(94, sticker.x))}%`;
            item.style.top = `${Math.max(0, Math.min(90, sticker.y))}%`;
            item.style.zIndex = String(Math.max(1, Number(sticker.layer) || 1));
            if (sticker.size) { item.style.width = sticker.size + "px"; item.style.height = sticker.size + "px"; item.style.fontSize = Math.round(sticker.size * .55) + "px"; }
            if (sticker.color && sticker.type !== "photo") item.style.backgroundColor = sticker.color;
            item.tabIndex = 0;
            item.setAttribute("aria-label", sticker.type === "note" ? "Editable mood board note" : "Mood board sticker");
            if (sticker.type === "note") {
                item.textContent = "";
                const note = document.createElement("textarea");
                note.value = sticker.text || "Write here...";
                note.setAttribute("aria-label", "Sticker note text");
                note.addEventListener("pointerdown", e => e.stopPropagation());
                note.addEventListener("input", () => { sticker.text = note.value; boardSave(); });
                item.appendChild(note);
            }
            else if (sticker.type === "photo") {
                const img = document.createElement("img");
                img.src = sticker.src;
                img.alt = sticker.name || "Uploaded photo sticker";
                item.appendChild(img);
                item.title = "Photo sticker · Drag to move · Select and press Delete to remove";
            }
            else {
                item.textContent = sticker.emoji;
                item.title = "Drag to move · Select and press Delete to remove";
            }
            item.addEventListener("pointerdown", e => {
                if (e.target.tagName === "TEXTAREA")
                    return;
                e.preventDefault();
                selectedStickerId = sticker.id;
                boardRender();
                const active = board.querySelector(`[data-id="${sticker.id}"]`);
                // The board’s screen dimensions convert pointer movement into percentage positions.
                const rect = board.getBoundingClientRect();
                const startX = e.clientX, startY = e.clientY, origX = sticker.x, origY = sticker.y;
                // Pointer capture helps keep tracking the drag even when the pointer moves.
                active.setPointerCapture?.(e.pointerId);
                // Move the sticker visually as the pointer moves; keep it inside board limits.
                const move = ev => {
                    sticker.x = Math.max(0, Math.min(94, origX + (ev.clientX - startX) / rect.width * 100));
                    sticker.y = Math.max(0, Math.min(90, origY + (ev.clientY - startY) / rect.height * 100));
                    active.style.left = sticker.x + "%";
                    active.style.top = sticker.y + "%";
                };
                // When dragging ends, remove temporary listeners and save the final position.
                const up = () => {
                    active.removeEventListener("pointermove", move);
                    active.removeEventListener("pointerup", up);
                    active.removeEventListener("pointercancel", up);
                    boardSave();
                };
                active.addEventListener("pointermove", move);
                active.addEventListener("pointerup", up);
                active.addEventListener("pointercancel", up);
            });
            item.addEventListener("click", () => {
                selectedStickerId = sticker.id;
                board.querySelectorAll(".board-sticker").forEach(el => el.classList.toggle("selected", el.dataset.id === selectedStickerId));
            });
            board.appendChild(item);
        });
    }
    // Look up the currently selected sticker object using its unique id.
    function selectedSticker() { return boardStickers.find(s => s.id === selectedStickerId); }
    // BACKGROUND COLOR PICKER: Update the board color immediately and save the setting.
    $("boardBackground").addEventListener("input", e => {
        boardBackground = e.target.value;
        board.style.backgroundColor = boardBackground;
        saveBoardBackground();
    });
    // STICKER COLOR PICKER: Recolor the selected emoji/note (photos are excluded).
    $("stickerColor").addEventListener("input", e => {
        const sticker = selectedSticker();
        if (!sticker || sticker.type === "photo") return;
        sticker.color = e.target.value; boardRender(); boardSave();
    });
    // STICKER SIZE SLIDER: Resize the selected mood-board sticker and save it.
    $("stickerSize").addEventListener("input", e => {
        const sticker = selectedSticker(); if (!sticker) return;
        sticker.size = Number(e.target.value); boardRender(); boardSave();
    });
    // Keep every sticker at a positive, unique layer. Move only one position
    // at a time so Forward and Backward behave consistently for every type.
    // LAYER ORDER: Sort stickers by layer, swap the selected sticker one position forward/backward, and renumber the layers. Higher layers appear on top.
    function moveStickerLayer(stickers, selectedId, direction) {
        const ordered = [...stickers].sort((a, b) =>
            (Number(a.layer) || 0) - (Number(b.layer) || 0) ||
            stickers.indexOf(a) - stickers.indexOf(b));
        const index = ordered.findIndex(sticker => sticker.id === selectedId);
        if (index < 0) return false;
        const next = index + direction;
        if (next < 0 || next >= ordered.length) return false;
        [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
        ordered.forEach((sticker, position) => { sticker.layer = position + 1; });
        return true;
    }
    // BRING FORWARD: Move the selected sticker one layer closer to the front.
    $("bringForward").addEventListener("click", () => {
        if (moveStickerLayer(boardStickers, selectedStickerId, 1)) {
            boardRender(); boardSave();
        }
    });
    // SEND BACKWARD: Move the selected sticker one layer toward the back.
    $("sendBackward").addEventListener("click", () => {
        if (moveStickerLayer(boardStickers, selectedStickerId, -1)) {
            boardRender(); boardSave();
        }
    });
    // CREATE MOOD BOARD STICKER: Give a new emoji/note a unique id, default size/color/layer, and starting position.
    function addBoardSticker(emoji, type = "emoji") {
        const rect = board.getBoundingClientRect();
        const count = boardStickers.length;
        const sticker = {
            id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()), emoji: type === "note" ? "" : emoji, type, color: $("stickerColor").value, size: type === "note" ? 116 : 65, layer: boardStickers.length + 1, x: Math.min(78, 8 + (count % 5) * 13),
            y: Math.min(78, 8 + (count % 6) * 12)
        };
        if (type === "note") {
            sticker.text = "Write here...";
        }
        boardStickers.push(sticker);
        selectedStickerId = sticker.id;
        boardSave();
        boardRender();
        if (type === "note") {
            const note = board.querySelector(`[data-id="${sticker.id}"] textarea`);
            note?.focus();
            note?.select();
        }
    }
    // STICKER TOOLBAR: Clicking adds a sticker; dragging prepares its data to be dropped on the board.
    document.querySelectorAll(".sticker-option").forEach(button => {
        button.addEventListener("click", () => addBoardSticker(button.dataset.sticker, button.classList.contains("note-sticker") ? "note" : "emoji"));
        button.addEventListener("dragstart", e => {
            draggedSticker = { emoji: button.dataset.sticker, type: button.classList.contains("note-sticker") ? "note" : "emoji" };
            if (e.dataTransfer) {
                e.dataTransfer.setData("text/plain", JSON.stringify(draggedSticker));
                e.dataTransfer.effectAllowed = "copy";
            }
        });
    });
    // ALLOW DROP: preventDefault enables dropping onto the mood board.
    board.addEventListener("dragover", e => { e.preventDefault(); if (e.dataTransfer)
        e.dataTransfer.dropEffect = "copy"; });
    // DROP STICKER: Read the dragged sticker data, calculate the drop position, create the sticker, and save its new coordinates.
    board.addEventListener("drop", e => {
        e.preventDefault();
        let data = draggedSticker;
        try {
            data = JSON.parse(e.dataTransfer.getData("text/plain")) || data;
        }
        catch { }
        if (!data)
            return;
        const rect = board.getBoundingClientRect();
        const x = Math.max(0, Math.min(94, (e.clientX - rect.left) / rect.width * 100));
        const y = Math.max(0, Math.min(90, (e.clientY - rect.top) / rect.height * 100));
        addBoardSticker(data.emoji, data.type);
        const newest = boardStickers[boardStickers.length - 1];
        newest.x = x;
        newest.y = y;
        boardSave();
        boardRender();
        draggedSticker = null;
    });
    // MOOD BOARD PHOTO UPLOAD: Validate each selected image, shrink it on a canvas, then add the photos as movable board stickers.
    $("moodBoardPhotoUpload").addEventListener("change", e => {
        const files = Array.from(e.target.files || []);
        if (!files.length)
            return;
        const processPhoto = (file) => new Promise((resolve, reject) => {
            if (!file.type.startsWith("image/")) {
                reject(new Error(file.name + " is not an image."));
                return;
            }
            const reader = new FileReader();
            reader.onerror = () => reject(new Error("Could not read " + file.name + "."));
            reader.onload = () => {
                const img = new Image();
                img.onerror = () => reject(new Error("Could not open " + file.name + "."));
                img.onload = () => {
                    const max = 500, scale = Math.min(1, max / Math.max(img.width, img.height));
                    const canvas = document.createElement("canvas");
                    canvas.width = Math.max(1, Math.round(img.width * scale));
                    canvas.height = Math.max(1, Math.round(img.height * scale));
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve({
                        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()), type: "photo", src: canvas.toDataURL("image/jpeg",
                        0.8), name: file.name, size: 100, layer: boardStickers.length + 1, x: Math.min(78, 8 + (boardStickers.length % 5) * 13), y: Math.min(78, 8 + (boardStickers.length % 6) * 12)
                    });
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
        Promise.all(files.map(processPhoto)).then(photos => {
            boardStickers.push(...photos);
            selectedStickerId = photos[photos.length - 1].id;
            boardSave();
            boardRender();
        }).catch(err => alert(err.message + " Please try another photo."))
            .finally(() => { e.target.value = ""; });
    });
    // CLEAR MOOD BOARD: Confirm before removing all stickers and notes.
    $("clearMoodBoard").addEventListener("click", () => {
        if (!boardStickers.length)
            return;
        if (confirm("Clear all stickers and notes from your mood board?")) {
            boardStickers = [];
            selectedStickerId = null;
            boardSave();
            boardRender();
        }
    });
    // DELETE SHORTCUT: Delete the selected board sticker with Delete/Backspace, except while typing in an input or textarea.
    document.addEventListener("keydown", e => {
        if ((e.key === "Delete" || e.key === "Backspace") && selectedStickerId && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
            boardStickers = boardStickers.filter(s => s.id !== selectedStickerId);
            selectedStickerId = null;
            boardSave();
            boardRender();
        }
    });
    // INITIAL LOAD: Verify the user session, retrieve saved data from the database, restore tabs/stickers/colors, then draw the interface. await waits for each Promise.
    async function initializePlanner() {
        try {
            const user = await MyPlannerAPI.requireSession();
           $("userGreeting").textContent = "Hey, " + user.name + "!";
            // The API returns the current user’s saved planner data; fall back to empty arrays if missing.
            const state = await MyPlannerAPI.getState();
            events = Array.isArray(state.events) ? state.events : [];
            tasks = Array.isArray(state.tasks) ? state.tasks : [];
            customCategories = Array.isArray(state.customCategories) ? state.customCategories : [];
            boardStickers = Array.isArray(state.boardStickers) ? state.boardStickers : [];
            boardBackground = /^#[0-9a-f]{6}$/i.test(state.boardSettings?.background || "") ? state.boardSettings.background : "#fffdf8";
            $("boardBackground").value = boardBackground;
            board.style.backgroundColor = boardBackground;
            calendarDecorations = state.calendarDecorations && !Array.isArray(state.calendarDecorations) ? state.calendarDecorations : {};
            customCategories.forEach(addCustomTab);
            readyToSave = true;
            boardRender();
            renderCalendar();
            renderDayDetails();
            renderCalendarStickerPreview();
        } catch (error) {
            console.error(error);
            if (error.message !== "Please log in.") {
                alert("Unable to load your planner from the database: " + error.message);
            }
        }
    }
    // SAFE EXIT: Finish pending mood-board and database saves before logging out or navigating to Finance.
    async function leavePlanner(destination) {
        clearTimeout(boardSaveTimer);
        if (readyToSave) {
            await MyPlannerAPI.saveSection("board", boardStickers);
        }
        await MyPlannerAPI.flushSaves();
        if (destination === "logout") {
            await MyPlannerAPI.logout();
        } else {
            window.location.href = destination;
        }
    }
    // FINANCE LINK: Save pending changes before opening finance.html.
    document.querySelector('a.tab[href="finance.html"]').addEventListener("click", event => {
        event.preventDefault();
        leavePlanner("finance.html").catch(reportSaveError);
    });
    // LOGOUT BUTTON: Save pending changes before ending the user session.
    $("logoutButton").addEventListener("click", () => {
        leavePlanner("logout").catch(reportSaveError);
    });
    // START APPLICATION: Run initialization after all functions and event listeners have been defined.
    initializePlanner();
})();
