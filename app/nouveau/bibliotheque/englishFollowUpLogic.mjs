export function getUpcomingEnglishBookings(bookings, now) {
  return bookings
    .filter((booking) => {
      const start = new Date(booking.startISO).getTime();
      return Number.isFinite(start) && start >= now && (
        (booking.status === "confirmed" && booking.paymentStatus === "paid") ||
        (booking.status === "pending" && Number(booking.holdExpiresAt) > now)
      );
    })
    .sort((left, right) => new Date(left.startISO).getTime() - new Date(right.startISO).getTime());
}
