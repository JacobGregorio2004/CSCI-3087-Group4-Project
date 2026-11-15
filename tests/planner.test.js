// Run with: node --test tests/*.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'MyPlannerPlus.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js', 'planner.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'planner.css'), 'utf8');
const has = id => new RegExp(`id=["']${id}["']`).test(html);

test('event modal has no category dropdown', () => { assert.ok(!has('eventCategory')); assert.doesNotMatch(html, /<option value="other">/); });
test('event creation uses the selected calendar', () => assert.match(js, /category: activeCategory === "creative" \? "all" : activeCategory/));
test('calendar folder maximum is ten including built-in calendars', () => { assert.match(js, /MAX_CALENDARS = 10/); assert.match(js, /customCategories\.length \+ 3 >= MAX_CALENDARS/); });
test('calendar deletion confirms and removes associated items', () => { assert.match(js, /confirm\(`Delete \$\{category\.name\}/); assert.match(js, /events = events\.filter\(item => item\.category !== category\.key\)/); assert.match(js, /tasks = tasks\.filter\(item => item\.category !== category\.key\)/); });
test('weekly event edit opens event editor', () => { assert.match(js, /jump\.textContent = "Edit"/); assert.match(js, /openEventEditor\(event\)/); });
test('event editor saves changes to existing event', () => assert.match(js, /Object\.assign\(existing, \{ title, date, time:/));
test('sticky note library does not show a thumbtack', () => assert.doesNotMatch(html, /📌/));
test('personalized greeting is populated from the session', () => { assert.ok(has('userGreeting')); assert.match(js, /"Hey, " \+ user\.name/); });
test('creative board has color, resize and layer controls', () => ['boardBackground','stickerColor','stickerSize','bringForward','sendBackward'].forEach(id => assert.ok(has(id), id)));
test('creative board layer and size values are saved with sticker state', () => { assert.match(js, /sticker\.layer =/); assert.match(js, /sticker\.size =/); assert.match(js, /boardSave\(\)/); });
test('background color has database save call', () => assert.match(js, /saveSection\("boardSettings"/));
test('core calendar and task controls are present', () => ['prevMonth','nextMonth','todayBtn','toggleCalendarDetails','addEventBtn','todoForm','addFolderBtn','clearMoodBoard','clearCalendarStickers','logoutButton'].forEach(id => assert.ok(has(id), id)));
test('existing calendar sticker and photo upload features remain', () => { assert.ok(has('calendarStickerUpload')); assert.ok(has('moodBoardPhotoUpload')); assert.match(js, /addCalendarEmoji/); });
test('custom calendar and board controls have styling', () => { assert.match(css, /\.remove-calendar/); assert.match(css, /\.board-customize/); });
test('new tasks are assigned to selected date and can be edited', () => { assert.match(js, /date: selectedDate, done: false/); assert.match(js, /prompt\("Edit task", task\.text\)/); });
