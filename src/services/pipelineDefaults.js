export const STARTERS = {
    // existing
    local_services: [
        { key: "new", name: "New" },
        { key: "qualified", name: "Qualified" },
        { key: "quoted", name: "Quoted" },
        { key: "scheduled", name: "Scheduled" },
        { key: "in_progress", name: "In Progress" },
        { key: "won", name: "Won", terminal: "won" },
        { key: "lost", name: "Lost", terminal: "lost" },
    ],
    d2c: [
        { key: "lead", name: "Lead" },
        { key: "engaged", name: "Engaged" },
        { key: "cart", name: "Cart Created" },
        { key: "pending", name: "Payment Pending" },
        { key: "fulfilled", name: "Fulfilled", terminal: "won" },
        { key: "lost", name: "Lost", terminal: "lost" },
    ],
    clinics: [
        { key: "new", name: "New" },
        { key: "pre", name: "Pre-Screened" },
        { key: "appt", name: "Appointment Set" },
        { key: "visited", name: "Visited" },
        { key: "plan", name: "Treatment Plan" },
        { key: "completed", name: "Completed", terminal: "won" },
        { key: "lost", name: "Lost", terminal: "lost" },
    ],

    // new categories you allow in signup
    restaurants: [
        { key: "inquiry", name: "Inquiry" },
        { key: "reservation_requested", name: "Reservation Requested" },
        { key: "confirmed", name: "Confirmed" },
        { key: "seated", name: "Seated" },
        { key: "completed", name: "Completed", terminal: "won" },
        { key: "no_show", name: "No-show", terminal: "lost" },
    ],
    real_estate: [
        { key: "new", name: "New" },
        { key: "qualified", name: "Qualified" },
        { key: "site_visit", name: "Site Visit" },
        { key: "offer_made", name: "Offer Made" },
        { key: "under_contract", name: "Under Contract" },
        { key: "closed", name: "Closed", terminal: "won" },
        { key: "lost", name: "Lost", terminal: "lost" },
    ],
    education: [
        { key: "inquiry", name: "Inquiry" },
        { key: "demo_booked", name: "Demo Booked" },
        { key: "demo_done", name: "Demo Completed" },
        { key: "enrolment_pending", name: "Enrolment Pending" },
        { key: "enrolled", name: "Enrolled", terminal: "won" },
        { key: "lost", name: "Lost", terminal: "lost" },
    ],
    fitness: [
        { key: "lead", name: "Lead" },
        { key: "trial_scheduled", name: "Trial Scheduled" },
        { key: "trial_done", name: "Trial Completed" },
        { key: "plan_selected", name: "Plan Selected" },
        { key: "active_member", name: "Active Member", terminal: "won" },
        { key: "lost", name: "Lost", terminal: "lost" },
    ],
    automotive: [
        { key: "lead", name: "Lead" },
        { key: "test_drive_set", name: "Test Drive Set" },
        { key: "quoted", name: "Quoted" },
        { key: "finance_pending", name: "Finance Pending" },
        { key: "delivered", name: "Delivered", terminal: "won" },
        { key: "lost", name: "Lost", terminal: "lost" },
    ],
    pro_services: [
        { key: "new", name: "New" },
        { key: "discovery", name: "Discovery" },
        { key: "proposal", name: "Proposal Sent" },
        { key: "negotiation", name: "Negotiation" },
        { key: "won", name: "Won", terminal: "won" },
        { key: "lost", name: "Lost", terminal: "lost" },
    ],
    salon_spa: [
        { key: "new", name: "New" },
        { key: "appt_set", name: "Appointment Set" },
        { key: "in_chair", name: "In Chair" },
        { key: "paid", name: "Paid", terminal: "won" },
        { key: "no_show", name: "No-show", terminal: "lost" },
    ],
};

export function inferPaymentStageKey(keys) {
    const pick = ["pending","payment","cart","quoted","fulfilled","paid"]
        .find(k => keys.some(x => x.includes(k)));
    return pick || null;
}
