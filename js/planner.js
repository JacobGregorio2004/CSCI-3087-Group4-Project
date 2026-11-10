
(() => {
    // Shortcut function for selecting an HTML element by its ID.
    const $ = id => document.getElementById(id);

    // Set the initial calendar date to today's date.
    const today = new Date();
    let viewYear = today.getFullYear();
    let viewMonth = today.getMonth();
    let selectedDate = toISODate(today);

    // The currently selected planner category.
    let activeCategory = "creative";

    // Arrays that store the planner's folders, events, and tasks.
    let customCategories = [];
    let events = [];
    let tasks = [];

    // These variables control when data is allowed to save to the database.
    let readyToSave = false;
    let saveErrorShown = false;

    // Displays an error if saving planner information fails.
    // Only shows the alert once to avoid repeatedly interrupting the user.
    function reportSaveError(error) {
        console.error("Could not save MyPlanner+ data:", error);
        if (!saveErrorShown) {
            saveErrorShown = true;
            alert("Your changes could not be saved to the database. " + error.message);
        }
    }

    // Saves calendar events, tasks, and custom folders to the database.
    function save() {
        if (!readyToSave) return;

        MyPlannerAPI.saveSection("planner", {
            events,
            tasks,
            customCategories
        }).catch(reportSaveError);
    }

    // Converts a JavaScript date into YYYY-MM-DD format.
    function toISODate(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    // Converts a YYYY-MM-DD date string back into a JavaScript date.
    function fromISODate(value) {
        const [y, m, d] = value.split("-").map(Number);
        return new Date(y, m - 1, d, 12);
    }

    // Formats a date into a readable format for the planner.
    function prettyDate(value) {
        return fromISODate(value).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
        });
    }

    // Finds the display name of a category.
    // Checks custom folders first, then uses the default category names.
    function categoryName(category) {
        return customCategories.find(c => c.key === category)?.name ||
            ({
                work: "Work",
                school: "School",
                home: "Home",
                all: "All",
                creative: "Creative"
            }[category] || category);
    }

    // Returns events for the selected date and currently active category.
    function visibleEvents() {
        return events.filter(e =>
            e.date === selectedDate &&
            (activeCategory === "all" || activeCategory === "creative" || e.category === activeCategory)
        );
    }

    // Builds the monthly calendar and displays its dates and events.
    function renderCalendar() {
        // Update the calendar heading with the current month and year.
        $("monthHeading").textContent = new Date(viewYear, viewMonth, 1)
            .toLocaleDateString(undefined, {
                month: "long",
                year: "numeric"
            });

        const grid = $("calendarGrid");
        grid.innerHTML = "";

        // Find the first day of the month and the Sunday before it.
        const first = new Date(viewYear, viewMonth, 1);
        const sundayOffset = first.getDay();
        const start = new Date(viewYear, viewMonth, 1 - sundayOffset);
        const todayISO = toISODate(new Date());

        // Create 42 calendar cells to display six complete weeks.
        for (let i = 0; i < 42; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);

            const iso = toISODate(date);

            // Create a calendar cell and apply classes for styling.
            const cell = document.createElement("div");
            cell.className = "day" +
                (date.getMonth() !== viewMonth ? " outside" : "") +
                (iso === todayISO ? " today" : "");

            // Make each calendar date accessible by keyboard and screen readers.
            cell.tabIndex = 0;
            cell.setAttribute("role", "button");
            cell.setAttribute("aria-label", prettyDate(iso) + ". Select date to view or add events.");

            // Display the number of the day.
            const number = document.createElement("div");
            number.className = "day-number";
            number.textContent = date.getDate();
            cell.appendChild(number);

            // Display any stickers saved to this calendar date.
            const decorations = calendarDecorations[iso] || [];

            if (decorations.length) {
                const decoWrap = document.createElement("div");
                decoWrap.className = "day-decorations";
                decoWrap.setAttribute("aria-label", decorations.length + " calendar stickers");

                // Display up to four stickers inside the calendar cell.
                decorations.slice(0, 4).forEach(sticker => {
                    if (sticker.type === "photo") {
                        // Display uploaded photo stickers.
                        const img = document.createElement("img");
                        img.className = "calendar-deco-photo";
                        img.src = sticker.src;
                        img.alt = "Photo sticker";
                        decoWrap.appendChild(img);
                    } else {
                        // Display emoji stickers.
                        const deco = document.createElement("span");
                        deco.className = "calendar-deco-emoji";
                        deco.textContent = sticker.emoji;
                        decoWrap.appendChild(deco);
                    }
                });

                // Show how many additional stickers are hidden.
                if (decorations.length > 4) {
                    const more = document.createElement("small");
                    more.textContent = "+" + (decorations.length - 4);
                    decoWrap.appendChild(more);
                }

                cell.appendChild(decoWrap);
            }

            // Find events scheduled for this date and category.
            const dayEvents = events.filter(e =>
                e.date === iso &&
                (activeCategory === "all" || activeCategory === "creative" || e.category === activeCategory)
            );

            // Display up to three event previews inside the calendar cell.
            dayEvents.slice(0, 3).forEach(e => {
                const chip = document.createElement("span");
                chip.className = "event-chip " + e.category;
                chip.textContent = (e.time ? e.time + " " : "") + e.title;
                cell.appendChild(chip);
            });

            // Show the number of additional events if there are more than three.
            if (dayEvents.length > 3) {
                const more = document.createElement("small");
                more.textContent = `+${dayEvents.length - 3} more`;
                cell.appendChild(more);
            }

            // Select a date when its calendar cell is clicked.
            const selectDay = () => {
                selectedDate = iso;

                // Change the displayed month if a date outside the current month is selected.
                if (date.getMonth() !== viewMonth) {
                    viewMonth = date.getMonth();
                    viewYear = date.getFullYear();
                }

                renderCalendar();
                renderDayDetails();
                renderCalendarStickerPreview();
            };

            // Allow users to select calendar dates using Enter or Space.
            cell.addEventListener("click", selectDay);
            cell.addEventListener("keydown", e => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectDay();
                }
            });

            // Highlight the currently selected date.
            if (iso === selectedDate) {
                cell.style.boxShadow = "inset 0 0 0 3px #d9b37c";
            }

            grid.appendChild(cell);
        }
    }

    // Displays the events, tasks, and weekly to-dos for the selected date.
    function renderDayDetails() {
        $("selectedDateTitle").textContent = prettyDate(selectedDate);

        const list = $("eventList");
        list.innerHTML = "";

        // Get the selected day's events and sort them by time.
        const dayEvents = visibleEvents().sort((a, b) =>
            (a.time || "").localeCompare(b.time || "")
        );

        // Display a message if there are no events.
        if (!dayEvents.length) {
            const empty = document.createElement("p");
            empty.className = "empty-note";
            empty.textContent = "No events for this date yet. Add one to get started!";
            list.appendChild(empty);
        }

        // Create a row for each calendar event.
        dayEvents.forEach(event => {
            const row = document.createElement("div");
            row.className = "event-row";

            // Display the event title and category information.
            const info = document.createElement("div");
            const title = document.createElement("strong");
            title.textContent = event.title;
            info.appendChild(title);

            const meta = document.createElement("small");
            meta.textContent = (event.time ? event.time + " · " : "") + categoryName(event.category);
            info.appendChild(meta);

            // Create the edit and delete buttons.
            const actions = document.createElement("div");
            actions.className = "item-actions";

            const edit = document.createElement("button");
            edit.type = "button";
            edit.className = "secondary-button";
            edit.textContent = "Edit";

            // Open the event editor with the selected event's information.
            edit.addEventListener("click", () => openEventEditor(event));

            const del = document.createElement("button");
            del.className = "delete-button";
            del.type = "button";
            del.textContent = "×";
            del.title = "Delete event";
            del.setAttribute("aria-label", "Delete " + event.title);

            // Ask for confirmation before deleting an event.
            del.addEventListener("click", () => {
                if (!confirm('Delete "' + event.title + '"?')) return;

                events = events.filter(e => e.id !== event.id);
                save();
                renderCalendar();
                renderDayDetails();
            });

            actions.append(edit, del);
            row.append(info, actions);
            list.appendChild(row);
        });

        // Refresh the regular to-do list and weekly event list.
        renderTasks();
        renderWorkWeekTasks();
    }

    // Finds the Monday and Sunday dates for the week containing the selected date.
    function getWeekRange(dateISO) {
        const date = fromISODate(dateISO);
        const mondayOffset = (date.getDay() + 6) % 7;

        const monday = new Date(date);
        monday.setDate(date.getDate() - mondayOffset);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        return {
            monday,
            sunday,
            start: toISODate(monday),
            end: toISODate(sunday)
        };
    }

    // Displays all calendar events scheduled during the selected week.
    function renderWorkWeekTasks() {
        const range = getWeekRange(selectedDate);

        // Format the beginning and ending dates of the week.
        const fmt = d => d.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric"
        });

        $("workWeekRange").textContent = `${fmt(range.monday)} – ${fmt(range.sunday)}`;

        const list = $("workWeekTodoList");
        list.innerHTML = "";

        // Find events between Monday and Sunday and sort them by date and time.
        const weekEvents = events
            .filter(event => event.date >= range.start && event.date <= range.end)
            .sort((a, b) =>
                a.date.localeCompare(b.date) ||
                (a.time || "").localeCompare(b.time || "")
            );

        // Display a message if there are no events during the week.
        if (!weekEvents.length) {
            const empty = document.createElement("p");
            empty.className = "empty-note";
            empty.textContent = "No events added for this week yet. Add a calendar event and it will appear here automatically.";
            list.appendChild(empty);
            return;
        }

        // Create a checklist item for each event.
        weekEvents.forEach(event => {
            const row = document.createElement("div");
            row.className = "todo-item" + (event.weekTaskDone ? " done" : "");

            const label = document.createElement("label");
            const check = document.createElement("input");
            check.type = "checkbox";
            check.checked = !!event.weekTaskDone;

            // Save the completion status when the checkbox changes.
            check.addEventListener("change", () => {
                event.weekTaskDone = check.checked;
                save();
                renderWorkWeekTasks();
            });

            // Display the event's date, time, category, and title.
            const span = document.createElement("span");
            span.textContent =
                `${fromISODate(event.date).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric"
                })}${event.time ? " · " + event.time : ""} — ${categoryName(event.category)}: ${event.title}`;

            label.append(check, span);

            // Allow users to jump to an event's date and edit it.
            const jump = document.createElement("button");
            jump.type = "button";
            jump.className = "secondary-button";
            jump.textContent = "Edit";
            jump.title = "Edit this calendar event";

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

    // Displays the regular to-do list based on the active planner category.
    function renderTasks() {
        const list = $("todoList");
        list.innerHTML = "";

        // Filter tasks so users only see tasks from their selected folder.
        const shown = tasks.filter(t =>
            activeCategory === "all" ||
            activeCategory === "creative" ||
            t.category === activeCategory
        );

        // Show a message when the list is empty.
        if (!shown.length) {
            const empty = document.createElement("p");
            empty.className = "empty-note";
            empty.textContent = "No tasks yet. Add your first task above.";
            list.appendChild(empty);
        }

        shown.forEach(task => {
            const row = document.createElement("div");
            row.className = "todo-item" + (task.done ? " done" : "");

            // Create a checkbox to mark the task as complete.
            const label = document.createElement("label");
            const check = document.createElement("input");
            check.type = "checkbox";
            check.checked = task.done;

            check.addEventListener("change", () => {
                task.done = check.checked;
                save();
                renderTasks();
            });

            const span = document.createElement("span");
            span.textContent = task.text;
            label.append(check, span);

            // Create the edit and delete controls for each task.
            const actions = document.createElement("div");
            actions.className = "item-actions";

            const edit = document.createElement("button");
            edit.type = "button";
            edit.className = "secondary-button";
            edit.textContent = "Edit";

            // Use a prompt to update the task description.
            edit.addEventListener("click", () => {
                const updated = prompt("Edit your to-do:", task.text);

                if (updated === null) return;

                if (!updated.trim()) {
                    alert("A to-do cannot be empty.");
                    return;
                }

                task.text = updated.trim();
                save();
                renderTasks();
            });

            const del = document.createElement("button");
            del.type = "button";
            del.className = "delete-button";
            del.textContent = "×";
            del.title = "Delete task";
            del.setAttribute("aria-label", "Delete task " + task.text);

            // Confirm before removing a task from the planner.
            del.addEventListener("click", () => {
                if (!confirm('Delete "' + task.text + '"?')) return;

                tasks = tasks.filter(t => t.id !== task.id);
                save();
                renderTasks();
            });

            actions.append(edit, del);
            row.append(label, actions);
            list.appendChild(row);
        });
    }

    // Switches between the Mood Board, Work, School, Home, All, and custom folders.
    function activateCategory(category, button) {
        activeCategory = category;

        // Update which folder tab appears selected.
        document.querySelectorAll(".tab").forEach(tab =>
            tab.classList.toggle("active", tab === button)
        );

        // Show the Mood Board or Calendar page depending on the selected folder.
        $("creativePage").classList.toggle("hidden", category !== "creative");
        $("calendarPage").classList.toggle("hidden", category === "creative");

        // Update and refresh the calendar when another folder is selected.
        if (category !== "creative") {
            $("calendarTitle").textContent = categoryName(category) + " Calendar";
            renderCalendar();
            renderDayDetails();
        }
    }

    // Listen for clicks on the planner folder tabs.
    $("tabs").addEventListener("click", e => {
        const button = e.target.closest("button.tab[data-category]");

        if (button) {
            activateCategory(button.dataset.category, button);
        }
    });

    // Move the calendar to the previous month.
    $("prevMonth").addEventListener("click", () => {
        viewMonth--;

        if (viewMonth < 0) {
            viewMonth = 11;
            viewYear--;
        }

        renderCalendar();
    });

    // Move the calendar to the next month.
    $("nextMonth").addEventListener("click", () => {
        viewMonth++;

        if (viewMonth > 11) {
            viewMonth = 0;
            viewYear++;
        }

        renderCalendar();
    });

    // Return the calendar to today's date.
    $("todayBtn").addEventListener("click", () => {
        const now = new Date();

        viewYear = now.getFullYear();
        viewMonth = now.getMonth();
        selectedDate = toISODate(now);

        renderCalendar();
        renderDayDetails();
        renderCalendarStickerPreview();
    });

    // Show or hide the planner details underneath the calendar.
    $("toggleCalendarDetails").addEventListener("click", () => {
        const details = $("calendarDetails");
        const opening = details.classList.contains("hidden");

        details.classList.toggle("hidden", !opening);

        // Update the button's accessibility information and label.
        $("toggleCalendarDetails").setAttribute("aria-expanded", String(opening));
        $("toggleCalendarDetails").textContent =
            opening ? "✏️ Hide planner details" : "✏️ Show planner details";
    });

    // Stores emoji and photo stickers assigned to individual calendar dates.
    let calendarDecorations = {};

    // Saves calendar decorations to the user's database account.
    function saveCalendarDecorations() {
        if (!readyToSave) return;

        MyPlannerAPI.saveSection("calendarDecorations", calendarDecorations)
            .catch(reportSaveError);
    }

    // Displays the stickers saved to the currently selected calendar date.
    function renderCalendarStickerPreview() {
        const preview = $("calendarStickerPreview");
        preview.innerHTML = "";

        $("creativeStickerDate").textContent = "Decorating: " + prettyDate(selectedDate);

        const stickers = calendarDecorations[selectedDate] || [];

        // Display a message if the selected date has no stickers.
        if (!stickers.length) {
            const empty = document.createElement("span");
            empty.className = "mini-board-empty";
            empty.textContent = "No stickers on this date yet. Add one above!";
            preview.appendChild(empty);
            return;
        }

        // Create a removable preview for each saved sticker.
        stickers.forEach((sticker, index) => {
            const remove = document.createElement("button");
            remove.type = "button";
            remove.title = "Click to remove this sticker";
            remove.setAttribute("aria-label", "Remove sticker from " + prettyDate(selectedDate));

            if (sticker.type === "photo") {
                // Display uploaded photo stickers.
                const img = document.createElement("img");
                img.className = "calendar-deco-photo";
                img.src = sticker.src;
                img.alt = "Uploaded photo sticker. Click to remove";
                remove.appendChild(img);
            } else {
                // Display emoji stickers.
                remove.className = "calendar-deco-emoji";
                remove.textContent = sticker.emoji;
            }

            // Remove the selected sticker when clicked.
            remove.addEventListener("click", () => {
                calendarDecorations[selectedDate].splice(index, 1);

                if (!calendarDecorations[selectedDate].length)
                    delete calendarDecorations[selectedDate];

                saveCalendarDecorations();
                renderCalendar();
                renderCalendarStickerPreview();
            });

            preview.appendChild(remove);
        });
    }

    // Adds an emoji sticker to the selected calendar date.
    function addCalendarEmoji(emoji) {
        if (!calendarDecorations[selectedDate]) {
            calendarDecorations[selectedDate] = [];
        }

        calendarDecorations[selectedDate].push({
            type: "emoji",
            emoji
        });

        saveCalendarDecorations();
        renderCalendar();
        renderCalendarStickerPreview();
    }

    // Connect the calendar decoration buttons to the emoji sticker function.
    document.querySelectorAll("[data-calendar-sticker]").forEach(button =>
        button.addEventListener("click", () =>
            addCalendarEmoji(button.dataset.calendarSticker)
        )
    );

    // Handle uploading a photo to use as a calendar sticker.
    $("calendarStickerUpload").addEventListener("change", e => {
        const file = e.target.files && e.target.files[0];

        if (!file) return;

        // Make sure the selected file is an image.
        if (!file.type.startsWith("image/")) {
            alert("Please choose an image file.");
            e.target.value = "";
            return;
        }

        // Read the selected image file.
        const reader = new FileReader();

        reader.onerror = () => {
            alert("That photo could not be read. Please try another image.");
            e.target.value = "";
        };

        reader.onload = () => {
            const img = new Image();

            img.onerror = () => {
                alert("That image could not be opened. Please try another photo.");
                e.target.value = "";
            };

            img.onload = () => {
                // Resize the photo so it does not take up too much storage.
                const max = 180;
                const scale = Math.min(1, max / Math.max(img.width, img.height));

                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));

                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Convert the resized image into a JPEG data URL.
                const stickerSrc = canvas.toDataURL("image/jpeg", 0.78);

                if (!calendarDecorations[selectedDate]) {
                    calendarDecorations[selectedDate] = [];
                }

                // Add the photo to the selected date and refresh the calendar.
                calendarDecorations[selectedDate].push({
                    type: "photo",
                    src: stickerSrc
                });

                saveCalendarDecorations();
                renderCalendar();
                renderCalendarStickerPreview();

                e.target.value = "";
            };

            img.src = reader.result;
        };

        reader.readAsDataURL(file);
    });

    // Remove every sticker assigned to the currently selected calendar date.
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

    // Display the initial calendar sticker preview.
    renderCalendarStickerPreview();

    // Stores the ID of the event currently being edited.
    let editingEventId = null;

    // Opens the event editor and fills in the selected event's existing information.
    function openEventEditor(event) {
        editingEventId = event.id;

        $("eventModalTitle").textContent = "Edit calendar event";
        $("eventName").value = event.title;
        $("eventDate").value = event.date;
        $("eventTime").value = event.time || "";

        $("eventForm").querySelector('button[type="submit"]').textContent = "Save changes";

        $("eventModal").classList.add("open");
        $("eventName").focus();
    }

    // Open a blank event form to create a new calendar event.
    $("addEventBtn").addEventListener("click", () => {
        // Prevent adding events directly from the All folder.
        if (activeCategory === "all") {
            alert("Open Work, School, Home, or one of your custom folders first. The event will automatically be added to that calendar.");
            return;
        }

        editingEventId = null;

        $("eventModalTitle").textContent = "Add calendar event";
        $("eventForm").querySelector('button[type="submit"]').textContent = "Save event";

        // Use the currently selected calendar date as the default date.
        $("eventDate").value = selectedDate;

        $("eventModal").classList.add("open");
        $("eventName").focus();
    });

    // Close the event form without saving changes.
    $("cancelEvent").addEventListener("click", () =>
        $("eventModal").classList.remove("open")
    );

    // Handle creating and editing calendar events.
    $("eventForm").addEventListener("submit", e => {
        e.preventDefault();

        const title = $("eventName").value.trim();
        const date = $("eventDate").value;

        if (!title || !date) return;

        if (editingEventId) {
            // Update an existing event.
            const existing = events.find(event => event.id === editingEventId);

            if (existing) {
                existing.title = title;
                existing.date = date;
                existing.time = $("eventTime").value;
            }
        } else {
            // Assign a new event to the currently selected folder.
            const destination =
                (["work", "school", "home"].includes(activeCategory) ||
                    activeCategory.startsWith("custom_"))
                    ? activeCategory : "school";

            // Create a unique ID so each event can be identified.
            events.push({
                id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
                title,
                date,
                time: $("eventTime").value,
                category: destination
            });
        }

        // Update the selected calendar date to match the event's date.
        selectedDate = date;

        const d = fromISODate(date);
        viewYear = d.getFullYear();
        viewMonth = d.getMonth();

        // Save the changes and refresh the planner.
        save();

        $("eventModal").classList.remove("open");
        $("eventForm").reset();
        editingEventId = null;

        renderCalendar();
        renderDayDetails();
        renderCalendarStickerPreview();
    });

    // Handle adding a new task to the regular to-do list.
    $("todoForm").addEventListener("submit", e => {
        e.preventDefault();

        const input = $("todoInput");
        const text = input.value.trim();

        if (!text) return;

        // Assign the task to the current folder.
        const category =
            (["work", "school", "home"].includes(activeCategory) ||
                activeCategory.startsWith("custom_"))
                ? activeCategory : "school";

        // Create the new task with a unique ID and an incomplete status.
        tasks.push({
            id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
            text,
            category,
            done: false
        });

        // Clear the input and refresh the to-do list.
        input.value = "";
        save();
        renderTasks();
    });

    // Creates a delete button beside each custom folder tab.
    function addFolderDeleteButton(key, tabButton) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "folder-delete";
        remove.dataset.deleteCategory = key;
        remove.textContent = "×";

        remove.title = "Delete " +
            (customCategories.find(c => c.key === key)?.name || "folder");

        remove.setAttribute("aria-label", remove.title);

        tabButton.insertAdjacentElement("afterend", remove);
    }

    // Handle deleting custom folders.
    $("tabs").addEventListener("click", e => {
        const remove = e.target.closest("button.folder-delete[data-delete-category]");

        if (!remove) return;

        const key = remove.dataset.deleteCategory;
        const folder = customCategories.find(c => c.key === key);

        if (!folder) return;

        // Count the events and tasks that will be deleted with this folder.
        const eventCount = events.filter(item => item.category === key).length;
        const taskCount = tasks.filter(item => item.category === key).length;

        // Ask for confirmation before deleting the folder and its contents.
        if (!confirm(`Delete "${folder.name}"? This also deletes ${eventCount} event(s) and ${taskCount} to-do(s) in this folder.`))
            return;

        // Remove the folder's events, tasks, and category information.
        events = events.filter(item => item.category !== key);
        tasks = tasks.filter(item => item.category !== key);
        customCategories = customCategories.filter(item => item.key !== key);

        // Remove the folder tab and its delete button from the page.
        $("tabs").querySelector(`button.tab[data-category="${key}"]`)?.remove();
        remove.remove();

        // Return to School if the deleted folder was currently open.
        if (activeCategory === key) {
            activateCategory("school", $("tabs").querySelector('button.tab[data-category="school"]'));
        }

        save();
        renderCalendar();
        renderDayDetails();
    });

    // Open the form for creating a new custom folder.
    $("addFolderBtn").addEventListener("click", () => {
        // Limit the number of custom folders to ten.
        if (customCategories.length >= 10) {
            alert("You can create up to 10 custom folders. Delete a folder before creating another.");
            return;
        }

        $("folderModal").classList.add("open");
        $("folderName").focus();
    });

    // Close the custom folder form.
    $("cancelFolder").addEventListener("click", () =>
        $("folderModal").classList.remove("open")
    );

    // Handle creating and saving custom folders.
    $("folderForm").addEventListener("submit", e => {
        e.preventDefault();

        const name = $("folderName").value.trim();

        if (!name) return;

        // Check the folder limit again before creating a new folder.
        if (customCategories.length >= 10) {
            alert("You can create up to 10 custom folders. Delete a folder before creating another.");
            $("folderModal").classList.remove("open");
            return;
        }

        // Prevent users from creating folders with duplicate names.
        if ([...document.querySelectorAll(".tab")].some(t =>
            t.textContent.trim().toLowerCase() === name.toLowerCase()
        )) {
            alert("A folder with that name already exists.");
            return;
        }

        // Create a unique category key and save the new folder.
        const key = "custom_" + Date.now();
        customCategories.push({ key, name });

        save();

        // Create and display the new folder tab.
        const button = document.createElement("button");
        button.className = "tab";
        button.dataset.category = key;
        button.textContent = "📁 " + name;

        $("tabs").insertBefore(button, $("addFolderBtn"));

        // Add a delete button beside the new folder.
        addFolderDeleteButton(key, button);

        // Reset the form and open the new folder.
        $("folderName").value = "";
        $("folderModal").classList.remove("open");

        activateCategory(key, button);
    });

    // Close a modal when the user clicks outside its form.
    ["eventModal", "folderModal"].forEach(id =>
        $(id).addEventListener("click", e => {
            if (e.target.id === id) {
                $(id).classList.remove("open");
            }
        })
    );

    // Allow the Escape key to close any currently open modal.
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") {
            document.querySelectorAll(".modal.open").forEach(m =>
                m.classList.remove("open")
            );
        }
    });

    // --------------------------------------------------
    // MOOD BOARD
    // Handles mood board stickers, notes, photos, and customization.
    // --------------------------------------------------

    // Stores the mood board stickers and their positions.
    let boardStickers = [];

    // Default colors used when creating a new mood board.
    let boardBackgroundColor = "#fffaf2";
    let selectedStickerColor = "#f8dce5";

    // Tracks the sticker being dragged and the currently selected sticker.
    let draggedSticker = null;
    let selectedStickerId = null;

    const board = $("moodBoard");

    // Timer used to delay database saves while users are typing.
    let boardSaveTimer = null;

    // Saves mood board information to the database.
    function boardSave() {
        if (!readyToSave) return;

        // Debounce typing in notes so each keystroke does not cause a database write.
        clearTimeout(boardSaveTimer);

        boardSaveTimer = setTimeout(() => {
            MyPlannerAPI.saveSection("board", boardStickers).catch(reportSaveError);
        }, 300);
    }

    // Rebuilds the mood board and displays all saved stickers.
    function boardRender() {
        // Apply the selected background color.
        board.style.backgroundColor = boardBackgroundColor;

        // Remove existing sticker elements before rebuilding the board.
        board.querySelectorAll(".board-sticker").forEach(el => el.remove());

        // Show the empty message only when there are no stickers.
        $("boardEmpty").style.display = boardStickers.length ? "none" : "flex";

        // Display every sticker except the saved settings object.
        boardStickers.filter(sticker => sticker.type !== "settings").forEach((sticker, stickerIndex) => {
            const item = document.createElement("div");

            // Apply the appropriate CSS classes based on the sticker type.
            item.className =
                "board-sticker" +
                (sticker.type === "note" ? " note " + (sticker.noteType || "") :
                    sticker.type === "photo" ? " photo-sticker" : "") +
                (selectedStickerId === sticker.id ? " selected" : "");

            item.dataset.id = sticker.id;

            // Set the sticker's position and layer on the board.
            item.style.left = `${Math.max(0, Math.min(94, sticker.x))}%`;
            item.style.top = `${Math.max(0, Math.min(90, sticker.y))}%`;
            item.style.zIndex = String(sticker.zIndex || stickerIndex + 1);

            // Apply the sticker's saved color.
            if (sticker.color) {
                item.style.backgroundColor = sticker.color;
                item.style.borderColor = sticker.color;
            }

            // Make stickers accessible through keyboard navigation.
            item.tabIndex = 0;
            item.setAttribute("aria-label",
                sticker.type === "note" ? "Editable mood board note" : "Mood board sticker"
            );

            if (sticker.type === "note") {
                // Create an editable sticky note.
                item.textContent = sticker.emoji + " ";

                const note = document.createElement("textarea");
                note.value = sticker.text || "Write here...";
                note.setAttribute("aria-label", "Sticker note text");

                // Prevent dragging the board sticker when clicking inside its text area.
                note.addEventListener("pointerdown", e => e.stopPropagation());

                // Save changes whenever the user edits the note.
                note.addEventListener("input", () => {
                    sticker.text = note.value;
                    boardSave();
                });

                item.appendChild(note);
            } else if (sticker.type === "photo") {
                // Display an uploaded photo sticker.
                const img = document.createElement("img");
                img.src = sticker.src;
                img.alt = sticker.name || "Uploaded photo sticker";

                item.appendChild(img);
                item.title = "Photo sticker · Drag to move · Select and press Delete to remove";
            } else {
                // Display a regular emoji sticker.
                item.textContent = sticker.emoji;
                item.title = "Drag to move · Select and press Delete to remove";
            }

            // Handle selecting and dragging a sticker around the board.
            item.addEventListener("pointerdown", e => {
                if (e.target.tagName === "TEXTAREA") return;

                e.preventDefault();

                selectedStickerId = sticker.id;

                // Refresh the board to highlight the selected sticker.
                boardRender();

                const active = board.querySelector(`[data-id="${sticker.id}"]`);
                const rect = board.getBoundingClientRect();

                // Record the starting pointer position and sticker position.
                const startX = e.clientX;
                const startY = e.clientY;
                const origX = sticker.x;
                const origY = sticker.y;

                active.setPointerCapture?.(e.pointerId);

                // Update the sticker's position while the pointer moves.
                const move = ev => {
                    sticker.x = Math.max(0, Math.min(94,
                        origX + (ev.clientX - startX) / rect.width * 100
                    ));

                    sticker.y = Math.max(0, Math.min(90,
                        origY + (ev.clientY - startY) / rect.height * 100
                    ));

                    active.style.left = sticker.x + "%";
                    active.style.top = sticker.y + "%";
                };

                // Stop dragging and save the final sticker position.
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

            // Highlight the sticker when it is selected.
            item.addEventListener("click", () => {
                selectedStickerId = sticker.id;

                board.querySelectorAll(".board-sticker").forEach(el =>
                    el.classList.toggle("selected", el.dataset.id === selectedStickerId)
                );
            });

            board.appendChild(item);
        });
    }

    // Stores the selected sticky note color style.
    let selectedNoteColor = "default";

    // Allow users to choose a style for their sticky notes.
    document.querySelectorAll("[data-note-color]").forEach(button => {
        button.addEventListener("click", () => {
            selectedNoteColor = button.dataset.noteColor;

            // Update the selected color button's accessibility state.
            document.querySelectorAll("[data-note-color]").forEach(option => {
                option.setAttribute("aria-pressed", String(option === button));
            });
        });
    });

    // Creates a new emoji sticker or sticky note on the mood board.
    function addBoardSticker(emoji, type = "emoji") {
        const rect = board.getBoundingClientRect();
        const count = boardStickers.length;

        // Create the sticker with a unique ID and starting position.
        const sticker = {
            id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
            emoji,
            type,
            x: Math.min(78, 8 + (count % 5) * 13),
            y: Math.min(78, 8 + (count % 6) * 12),
            color: selectedStickerColor,
            zIndex: count + 1
        };

        // Add default text and the selected style when creating a sticky note.
        if (type === "note") {
            sticker.text = "Write here...";
            sticker.noteType = selectedNoteColor === "default" ? "" : selectedNoteColor;
        }

        boardStickers.push(sticker);
        selectedStickerId = sticker.id;

        // Save the new sticker and refresh the board.
        boardSave();
        boardRender();

        // Automatically focus the text area when a sticky note is created.
        if (type === "note") {
            const note = board.querySelector(`[data-id="${sticker.id}"] textarea`);
            note?.focus();
            note?.select();
        }
    }

    // Allow users to add stickers by clicking or dragging from the sticker library.
    document.querySelectorAll(".sticker-option").forEach(button => {
        button.addEventListener("click", () =>
            addBoardSticker(
                button.dataset.sticker,
                button.classList.contains("note-sticker") ? "note" : "emoji"
            )
        );

        // Store sticker information when a drag operation begins.
        button.addEventListener("dragstart", e => {
            draggedSticker = {
                emoji: button.dataset.sticker,
                type: button.classList.contains("note-sticker") ? "note" : "emoji"
            };

            if (e.dataTransfer) {
                e.dataTransfer.setData("text/plain", JSON.stringify(draggedSticker));
                e.dataTransfer.effectAllowed = "copy";
            }
        });
    });

    // Allow stickers to be dropped onto the mood board.
    board.addEventListener("dragover", e => {
        e.preventDefault();

        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "copy";
        }
    });

    // Handle dropping a sticker and placing it at the pointer's position.
    board.addEventListener("drop", e => {
        e.preventDefault();

        let data = draggedSticker;

        // Retrieve the sticker information from the drag operation.
        try {
            data = JSON.parse(e.dataTransfer.getData("text/plain")) || data;
        } catch { }

        if (!data) return;

        // Calculate the sticker's position as a percentage of the board.
        const rect = board.getBoundingClientRect();

        const x = Math.max(0, Math.min(94,
            (e.clientX - rect.left) / rect.width * 100
        ));

        const y = Math.max(0, Math.min(90,
            (e.clientY - rect.top) / rect.height * 100
        ));

        // Create the sticker and update its position to the drop location.
        addBoardSticker(data.emoji, data.type);

        const newest = boardStickers[boardStickers.length - 1];
        newest.x = x;
        newest.y = y;

        boardSave();
        boardRender();

        draggedSticker = null;
    });

    // Handle uploading one or more personal photos to the mood board.
    $("moodBoardPhotoUpload").addEventListener("change", e => {
        const files = Array.from(e.target.files || []);

        if (!files.length) return;

        // Read, resize, and convert each uploaded photo.
        const processPhoto = (file) => new Promise((resolve, reject) => {
            // Make sure the uploaded file is an image.
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
                    // Resize the image to a maximum dimension of 500 pixels.
                    const max = 500;
                    const scale = Math.min(1, max / Math.max(img.width, img.height));

                    const canvas = document.createElement("canvas");
                    canvas.width = Math.max(1, Math.round(img.width * scale));
                    canvas.height = Math.max(1, Math.round(img.height * scale));

                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    // Convert the photo into a smaller JPEG for storage.
                    resolve({
                        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
                        type: "photo",
                        src: canvas.toDataURL("image/jpeg", 0.8),
                        name: file.name,
                        x: Math.min(78, 8 + (boardStickers.length % 5) * 13),
                        y: Math.min(78, 8 + (boardStickers.length % 6) * 12)
                    });
                };

                img.src = reader.result;
            };

            reader.readAsDataURL(file);
        });

        // Process all uploaded photos and add them to the board.
        Promise.all(files.map(processPhoto))
            .then(photos => {
                boardStickers.push(...photos);

                // Select the most recently uploaded photo.
                selectedStickerId = photos[photos.length - 1].id;

                boardSave();
                boardRender();
            })
            .catch(err => alert(err.message + " Please try another photo."))
            .finally(() => {
                e.target.value = "";
            });
    });

    // Saves the mood board's background and sticker color settings.
    function saveBoardSettings() {
        let settings = boardStickers.find(sticker => sticker.type === "settings");

        // Create a settings object if one does not already exist.
        if (!settings) {
            settings = {
                id: "__board_settings__",
                type: "settings"
            };

            boardStickers.push(settings);
        }

        settings.backgroundColor = boardBackgroundColor;
        settings.stickerColor = selectedStickerColor;

        boardSave();
    }

    // Update the selected sticker's color.
    $("stickerColor")?.addEventListener("input", () => {
        selectedStickerColor = $("stickerColor").value;

        const selected = boardStickers.find(sticker =>
            sticker.id === selectedStickerId
        );

        if (selected) {
            selected.color = selectedStickerColor;
        }

        saveBoardSettings();
        boardRender();
    });

    // Change the mood board's background color.
    $("boardColor")?.addEventListener("input", () => {
        boardBackgroundColor = $("boardColor").value;

        saveBoardSettings();
        boardRender();
    });

    // Bring the selected sticker to the front of the mood board.
    $("bringStickerForward")?.addEventListener("click", () => {
        const selected = boardStickers.find(sticker =>
            sticker.id === selectedStickerId
        );

        if (!selected) return;

        selected.zIndex = Math.max(
            0,
            ...boardStickers.filter(s => s.type !== "settings").map(s => s.zIndex || 0)
        ) + 1;

        boardSave();
        boardRender();
    });

    // Send the selected sticker behind the other stickers.
    $("sendStickerBackward")?.addEventListener("click", () => {
        const selected = boardStickers.find(sticker =>
            sticker.id === selectedStickerId
        );

        if (!selected) return;

        const others = boardStickers.filter(s =>
            s.type !== "settings" && s.id !== selected.id
        );

        selected.zIndex = Math.max(
            0,
            Math.min(1, ...others.map(s => s.zIndex || 1)) - 1
        );

        boardSave();
        boardRender();
    });

    // Clear all stickers and notes from the mood board.
    $("clearMoodBoard").addEventListener("click", () => {
        if (!boardStickers.length) return;

        if (confirm("Clear all stickers and notes from your mood board?")) {
            // Keep the saved color settings while removing the other stickers.
            boardStickers = boardStickers.filter(sticker => sticker.type === "settings");

            selectedStickerId = null;

            boardSave();
            boardRender();
        }
    });

    // Allow users to remove the selected sticker with Delete or Backspace.
    document.addEventListener("keydown", e => {
        if (
            (e.key === "Delete" || e.key === "Backspace") &&
            selectedStickerId &&
            !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)
        ) {
            boardStickers = boardStickers.filter(s =>
                s.id !== selectedStickerId && s.type !== "settings"
            );

            selectedStickerId = null;

            boardSave();
            boardRender();
        }
    });

    // --------------------------------------------------
    // DATABASE AND ACCOUNT MANAGEMENT
    // Loads saved planner information and handles navigation.
    // --------------------------------------------------

    // Load the user's planner information after confirming their login session.
    async function initializePlanner() {
        try {
            // Check whether the user has an active login session.
            const user = await MyPlannerAPI.requireSession();

            // Display the logged-in user's name.
            $("currentUserName").textContent = user.name;

            // Retrieve the saved planner information from the database.
            const state = await MyPlannerAPI.getState();

            // Load saved events, tasks, and custom folders.
            events = Array.isArray(state.events) ? state.events : [];
            tasks = Array.isArray(state.tasks) ? state.tasks : [];
            customCategories = Array.isArray(state.customCategories) ? state.customCategories : [];

            // Load saved mood board stickers.
            boardStickers = Array.isArray(state.boardStickers) ? state.boardStickers : [];

            // Restore the user's saved mood board colors.
            const savedBoardSettings = boardStickers.find(sticker =>
                sticker.type === "settings"
            );

            if (savedBoardSettings) {
                boardBackgroundColor = savedBoardSettings.backgroundColor || boardBackgroundColor;
                selectedStickerColor = savedBoardSettings.stickerColor || selectedStickerColor;

                if ($("boardColor")) {
                    $("boardColor").value = boardBackgroundColor;
                }

                if ($("stickerColor")) {
                    $("stickerColor").value = selectedStickerColor;
                }
            }

            // Remove the old Other category from saved custom folders.
            customCategories = customCategories.filter(category =>
                category.name.toLowerCase() !== "other"
            );

            // Move any older events and tasks from Other into Home.
            events.forEach(item => {
                if (item.category === "other") item.category = "home";
            });

            tasks.forEach(item => {
                if (item.category === "other") item.category = "home";
            });

            // Load saved calendar stickers.
            calendarDecorations =
                state.calendarDecorations && !Array.isArray(state.calendarDecorations)
                    ? state.calendarDecorations : {};

            // Recreate the user's custom folder tabs.
            customCategories.forEach(category => {
                const button = document.createElement("button");
                button.className = "tab";
                button.dataset.category = category.key;
                button.textContent = "📁 " + category.name;

                $("tabs").insertBefore(button, $("addFolderBtn"));

                addFolderDeleteButton(category.key, button);
            });

            // Allow database saving after all saved information has loaded.
            readyToSave = true;

            // Display the saved mood board, calendar, events, and stickers.
            boardRender();
            renderCalendar();
            renderDayDetails();
            renderCalendarStickerPreview();

        } catch (error) {
            // Display errors if the planner cannot load.
            console.error(error);

            if (error.message !== "Please log in.") {
                alert("Unable to load your planner from the database: " + error.message);
            }
        }
    }

    // Save outstanding changes before leaving the planner or logging out.
    async function leavePlanner(destination) {
        // Stop any pending mood board save timer.
        clearTimeout(boardSaveTimer);

        // Save the latest mood board information before leaving.
        if (readyToSave) {
            await MyPlannerAPI.saveSection("board", boardStickers);
        }

        // Wait for all pending database saves to finish.
        await MyPlannerAPI.flushSaves();

        // Log out or navigate to the requested page.
        if (destination === "logout") {
            await MyPlannerAPI.logout();
        } else {
            window.location.href = destination;
        }
    }

    // Save planner changes before navigating to the Finance page.
    document.querySelector('a.tab[href="finance.html"]').addEventListener("click", event => {
        event.preventDefault();

        leavePlanner("finance.html").catch(reportSaveError);
    });

    // Save planner changes and end the user's session when logging out.
    $("logoutButton").addEventListener("click", () => {
        leavePlanner("logout").catch(reportSaveError);
    });

    // Start the planner by loading the user's saved information.
    initializePlanner();

})();
