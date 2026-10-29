<?php
declare(strict_types=1);
require_once __DIR__ . '/testHelpers.php';
runChecks(function (): void {
    // Each operation must target the same isolated test event; do not touch real calendar data.
    verify(testCalendar('create'), 'Calendar event can be created');
    verify(testCalendar('read'), 'Calendar event can be retrieved');
    verify(testCalendar('update'), 'Calendar event can be updated');
    verify(testCalendar('delete'), 'Calendar event can be deleted');
});
