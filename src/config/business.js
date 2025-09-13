// src/config/business.js

export const ALLOWED_CATEGORIES = [
    "local_services", "d2c", "clinics", "real_estate", "education",
    "fitness", "restaurants", "automotive", "pro_services", "salon_spa",
];

export const SUBCATEGORIES = {
    local_services: [
        { id: "carpentry" }, { id: "plumbing" }, { id: "electrician" },
        { id: "ac_repair" }, { id: "cleaning" }, { id: "appliance_repair" },
    ],
    d2c: [
        { id: "fashion" }, { id: "electronics" }, { id: "beauty_cosmetics" },
        { id: "grocery" }, { id: "home_decor" }, { id: "books" },
    ],
    clinics: [
        { id: "dental" }, { id: "physio" }, { id: "dermatology" }, { id: "general_clinic" },
    ],
    real_estate: [
        { id: "residential_sales" }, { id: "rentals" }, { id: "plots" }, { id: "commercial" },
    ],
    education: [
        { id: "k12_tuition" }, { id: "test_prep" }, { id: "skill_courses" }, { id: "music_dance" },
    ],
    fitness: [
        { id: "gym" }, { id: "yoga" }, { id: "crossfit" }, { id: "personal_training" },
    ],
    restaurants: [
        { id: "qsr" }, { id: "dine_in" }, { id: "cloud_kitchen" }, { id: "cafe_bakery" },
    ],
    automotive: [
        { id: "auto_sales" }, { id: "auto_service" }, { id: "used_cars" }, { id: "two_wheelers" },
    ],
    pro_services: [
        { id: "consulting" }, { id: "legal" }, { id: "accounting" }, { id: "design_agency" },
    ],
    salon_spa: [
        { id: "unisex_salon" }, { id: "mens_salon" }, { id: "spa" },
    ],
};

export function isValidCategory(cat) {
    return ALLOWED_CATEGORIES.includes(cat);
}

export function isValidSubcategory(cat, sub) {
    if (!cat || !sub) return false;
    return (SUBCATEGORIES[cat] || []).some(s => s.id === sub);
}
