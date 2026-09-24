# Booking UI components

`BookingSlotPicker` renders the date grid and time choices from caller-supplied days, slots, labels, and callbacks. The caller computes availability and owns booking state. In this site, `app/nouveau/reserver/BookingCalendar.js` is that adapter.

`AvailabilityEditor` renders controlled weekly hours and date exceptions. The caller owns draft state, validation, authorization, and persistence. In this site, `app/admin/disponibilites/AvailabilityManager.js` is that adapter.

These components use the site's existing CSS classes. A new entry point must import `app/nouveau/reserver/booking.css` for `BookingSlotPicker` and `app/admin/disponibilites/availability.css` for `AvailabilityEditor`. The picker also expects an `.am-booking-calendar` ancestor. Copy the relevant styles and shared design tokens when moving the components into a boilerplate or another site.
