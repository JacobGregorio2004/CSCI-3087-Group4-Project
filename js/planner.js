(() => {
    const STORAGE_KEY = "myplannerPlusData_v1";
    const today = new Date();
    let viewYear = today.getFullYear();
    let viewMonth = today.getMonth();
    let selectedDate = toISODate(today);
    let activeCategory = "creative";
    let customCategories = [];
    let events = [];
    let tasks = [];
    const $ = id => document.getElementById(id);
    const safeLoad = () => {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
            events = Array.isArray(saved.events) ? saved.events : [];
            tasks = Array.isArray(saved.tasks) ? saved.tasks : [];
            customCategories = Array.isArray(saved.customCategories) ? saved.customCategories : [];
        }
        catch {
            events = [];
            tasks = [];
            customCategories = [];
        }
    };
    const save = () => {
        try {
            const storedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
            const preservedData = storedData && typeof storedData === "object" && !Array.isArray(storedData) ? storedData : {};
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...preservedData, events, tasks, customCategories }));
        }
        catch {
            alert("Your browser could not save changes. Check browser storage settings.");
        }
    };
    function toISODate(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }
    function fromISODate(value) {
        const [y, m, d] = value.split("-").map(Number);
        return new Date(y, m - 1, d, 12);
    }
    function prettyDate(value) {
        return fromISODate(value).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    }
    function categoryName(category) {
        return customCategories.find(c => c.key === category)?.name ||
            ({ work: "Work", school: "School", home: "Home", other: "Other", all: "All", creative: "Creative" }[category] || category);
    }
    function visibleEvents() {
        return events.filter(e => e.date === selectedDate &&
            (activeCategory === "all" || activeCategory === "creative" || e.category === activeCategory));
    }
    function renderCalendar() {
        $("monthHeading").textContent = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
        const grid = $("calendarGrid");
        grid.innerHTML = "";
        const first = new Date(viewYear, viewMonth, 1);
        const mondayOffset = (first.getDay() + 6) % 7;
        const start = new Date(viewYear, viewMonth, 1 - mondayOffset);
        const todayISO = toISODate(new Date());
        for (let i = 0; i < 42; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            const iso = toISODate(date);
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
                        img.src = sticker.src;
                        img.alt = "Photo sticker";
                        decoWrap.appendChild(img);
                    }
                    else {
                        const deco = document.createElement("span");
                        deco.className = "calendar-deco-emoji";
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
            const dayEvents = events.filter(e => e.date === iso && (activeCategory === "all" || activeCategory === "creative" || e.category === activeCategory));
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
            row.append(info, del);
            list.appendChild(row);
        });
        renderTasks();
        renderWorkWeekTasks();
    }
    function getWeekRange(dateISO) {
        const date = fromISODate(dateISO);
        const mondayOffset = (date.getDay() + 6) % 7;
        const monday = new Date(date);
        monday.setDate(date.getDate() - mondayOffset);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return { monday, sunday, start: toISODate(monday), end: toISODate(sunday) };
    }
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
            jump.textContent = "View";
            jump.title = "View this event's date";
            jump.addEventListener("click", () => {
                selectedDate = event.date;
                const d = fromISODate(event.date);
                viewYear = d.getFullYear();
                viewMonth = d.getMonth();
                renderCalendar();
                renderDayDetails();
            });
            row.append(label, jump);
            list.appendChild(row);
        });
    }
    function renderTasks() {
        const list = $("todoList");
        list.innerHTML = "";
        const shown = tasks.filter(t => activeCategory === "all" || activeCategory === "creative" || t.category === activeCategory);
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
            row.append(label, del);
            list.appendChild(row);
        });
    }
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
    $("tabs").addEventListener("click", e => {
        const button = e.target.closest(".tab");
        if (button)
            activateCategory(button.dataset.category, button);
    });
    $("prevMonth").addEventListener("click", () => { viewMonth--; if (viewMonth < 0) {
        viewMonth = 11;
        viewYear--;
    } renderCalendar(); });
    $("nextMonth").addEventListener("click", () => { viewMonth++; if (viewMonth > 11) {
        viewMonth = 0;
        viewYear++;
    } renderCalendar(); });
    $("todayBtn").addEventListener("click", () => {
        const now = new Date();
        viewYear = now.getFullYear();
        viewMonth = now.getMonth();
        selectedDate = toISODate(now);
        renderCalendar();
        renderDayDetails();
        renderCalendarStickerPreview();
    });
    $("toggleCalendarDetails").addEventListener("click", () => {
        const details = $("calendarDetails");
        const opening = details.classList.contains("hidden");
        details.classList.toggle("hidden", !opening);
        $("toggleCalendarDetails").setAttribute("aria-expanded", String(opening));
        $("toggleCalendarDetails").textContent = opening ? "✏️ Hide planner details" : "✏️ Show planner details";
    });
    const CALENDAR_DECOR_KEY = "myplannerPlusCalendarDecorations_v1";
    let calendarDecorations = {};
    try {
        const savedDecor = JSON.parse(localStorage.getItem(CALENDAR_DECOR_KEY) || "{}");
        calendarDecorations = savedDecor && typeof savedDecor === "object" && !Array.isArray(savedDecor) ? savedDecor : {};
    }
    catch {
        calendarDecorations = {};
    }
    function saveCalendarDecorations() {
        try {
            localStorage.setItem(CALENDAR_DECOR_KEY, JSON.stringify(calendarDecorations));
        }
        catch {
            alert("This sticker could not be saved because browser storage is full. Try a smaller photo.");
        }
    }
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
            const remove = document.createElement("button");
            remove.type = "button";
            remove.title = "Click to remove this sticker";
            remove.setAttribute("aria-label", "Remove sticker from " + prettyDate(selectedDate));
            if (sticker.type === "photo") {
                const img = document.createElement("img");
                img.className = "calendar-deco-photo";
                img.src = sticker.src;
                img.alt = "Uploaded photo sticker. Click to remove";
                remove.appendChild(img);
            }
            else {
                remove.className = "calendar-deco-emoji";
                remove.textContent = sticker.emoji;
            }
            remove.addEventListener("click", () => {
                calendarDecorations[selectedDate].splice(index, 1);
                if (!calendarDecorations[selectedDate].length)
                delete calendarDecorations[selectedDate]; saveCalendarDecorations(); renderCalendar(); renderCalendarStickerPreview(); });
            preview.appendChild(remove);
        });
    }
    function addCalendarEmoji(emoji) {
        if (!calendarDecorations[selectedDate])
            calendarDecorations[selectedDate] = [];
        calendarDecorations[selectedDate].push({ type: "emoji", emoji });
        saveCalendarDecorations();
        renderCalendar();
        renderCalendarStickerPreview();
    }
    document.querySelectorAll("[data-calendar-sticker]").forEach(button => button.addEventListener("click", () => addCalendarEmoji(button.dataset.calendarSticker)));
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
    $("addEventBtn").addEventListener("click", () => {
        $("eventDate").value = selectedDate;
        $("eventCategory").value = ["work", "school", "home", "other"].includes(activeCategory) ? activeCategory : "school";
        $("eventModal").classList.add("open");
        $("eventName").focus();
    });
    $("cancelEvent").addEventListener("click", () => $("eventModal").classList.remove("open"));
    $("eventForm").addEventListener("submit", e => {
        e.preventDefault();
        const title = $("eventName").value.trim();
        const date = $("eventDate").value;
        if (!title || !date)
            return;
        events.push({
            id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()), title, date, time: $("eventTime").value,
            category: $("eventCategory").value
        });
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
    $("todoForm").addEventListener("submit", e => {
        e.preventDefault();
        const input = $("todoInput");
        const text = input.value.trim();
        if (!text)
            return;
        const category = ["work", "school", "home", "other"].includes(activeCategory) ? activeCategory : "school";
        tasks.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()), text, category, done: false });
        input.value = "";
        save();
        renderTasks();
    });
    $("addFolderBtn").addEventListener("click", () => { $("folderModal").classList.add("open"); $("folderName").focus(); });
    $("cancelFolder").addEventListener("click", () => $("folderModal").classList.remove("open"));
    $("folderForm").addEventListener("submit", e => {
        e.preventDefault();
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
        const button = document.createElement("button");
        button.className = "tab";
        button.dataset.category = key;
        button.textContent = "📁 " + name;
        $("tabs").insertBefore(button, $("addFolderBtn"));
        $("folderName").value = "";
        $("folderModal").classList.remove("open");
        activateCategory(key, button);
    });
    ["eventModal", "folderModal"].forEach(id => $(id).addEventListener("click", e => { if (e.target.id === id)
        $(id).classList.remove("open"); }));
    document.addEventListener("keydown", e => { if (e.key === "Escape")
        document.querySelectorAll(".modal.open").forEach(m => m.classList.remove("open")); });
    // Mood board sticker state and drag/drop interactions.
    let boardStickers = [];
    let draggedSticker = null;
    let selectedStickerId = null;
    const board = $("moodBoard");
    function boardSave() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
            saved.boardStickers = boardStickers;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        }
        catch { /* board remains usable for this session if storage is unavailable */ }
    }
    function boardRender() {
        board.querySelectorAll(".board-sticker").forEach(el => el.remove());
        $("boardEmpty").style.display = boardStickers.length ? "none" : "flex";
        boardStickers.forEach(sticker => {
            const item = document.createElement("div");
            item.className = "board-sticker" + (sticker.type === "note" ? " note " + (sticker.noteType || "") : sticker.type === "photo" ? " photo-sticker" : "") + (selectedStickerId === sticker.id ? " selected" : "");
            item.dataset.id = sticker.id;
            item.style.left = `${Math.max(0, Math.min(94, sticker.x))}%`;
            item.style.top = `${Math.max(0, Math.min(90, sticker.y))}%`;
            item.tabIndex = 0;
            item.setAttribute("aria-label", sticker.type === "note" ? "Editable mood board note" : "Mood board sticker");
            if (sticker.type === "note") {
                item.textContent = sticker.emoji + " ";
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
                const rect = board.getBoundingClientRect();
                const startX = e.clientX, startY = e.clientY, origX = sticker.x, origY = sticker.y;
                active.setPointerCapture?.(e.pointerId);
                const move = ev => {
                    sticker.x = Math.max(0, Math.min(94, origX + (ev.clientX - startX) / rect.width * 100));
                    sticker.y = Math.max(0, Math.min(90, origY + (ev.clientY - startY) / rect.height * 100));
                    active.style.left = sticker.x + "%";
                    active.style.top = sticker.y + "%";
                };
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
    let selectedNoteColor = "default";
    document.querySelectorAll("[data-note-color]").forEach(button => {
        button.addEventListener("click", () => {
            selectedNoteColor = button.dataset.noteColor;
            document.querySelectorAll("[data-note-color]").forEach(option => {
                option.setAttribute("aria-pressed", String(option === button));
            });
        });
    });
    function addBoardSticker(emoji, type = "emoji") {
        const rect = board.getBoundingClientRect();
        const count = boardStickers.length;
        const sticker = {
            id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()), emoji, type, x: Math.min(78, 8 + (count % 5) * 13),
            y: Math.min(78, 8 + (count % 6) * 12)
        };
        if (type === "note") {
            sticker.text = "Write here...";
            sticker.noteType = selectedNoteColor === "default" ? "" : selectedNoteColor;
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
    board.addEventListener("dragover", e => { e.preventDefault(); if (e.dataTransfer)
        e.dataTransfer.dropEffect = "copy"; });
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
                        0.8), name: file.name, x: Math.min(78, 8 + (boardStickers.length % 5) * 13), y: Math.min(78, 8 + (boardStickers.length % 6) * 12)
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
    document.addEventListener("keydown", e => {
        if ((e.key === "Delete" || e.key === "Backspace") && selectedStickerId && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
            boardStickers = boardStickers.filter(s => s.id !== selectedStickerId);
            selectedStickerId = null;
            boardSave();
            boardRender();
        }
    });
    safeLoad();
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        boardStickers = Array.isArray(saved.boardStickers) ? saved.boardStickers : [];
    }
    catch {
        boardStickers = [];
    }
    customCategories.forEach(c => {
        const button = document.createElement("button");
        button.className = "tab";
        button.dataset.category = c.key;
        button.textContent = "📁 " + c.name;
        $("tabs").insertBefore(button, $("addFolderBtn"));
    });
    boardRender();
    renderCalendar();
    renderDayDetails();
})();
