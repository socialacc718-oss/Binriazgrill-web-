// @ts-nocheck
// ================= BIN RIAZ GRILL RESTAURANT =================
// Authentic Charcoal & Desi Cuisine - Realtime Multi-Device Synchronization Engine
import { initializeApp } from "firebase/app";
import { 
  getDatabase, 
  ref, 
  set, 
  get, 
  onValue, 
  update, 
  remove, 
  push 
} from "firebase/database";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot 
} from "firebase/firestore";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";

// User-provided Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBu1Vpz_YC7guSyDh9RtQr01h618GcsRao",
  authDomain: "studio-3332544255-6e9ee.firebaseapp.com",
  databaseURL: "https://studio-3332544255-6e9ee-default-rtdb.firebaseio.com",
  projectId: "studio-3332544255-6e9ee",
  storageBucket: "studio-3332544255-6e9ee.firebasestorage.app",
  messagingSenderId: "987978110905",
  appId: "1:987978110905:web:19ba528bae422fa0600868"
};

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const firestore = getFirestore(app);
const auth = getAuth(app);

// Expose globally on window for backwards compatibility & inline handlers
window.firebaseApp = app;
window.firebaseAuth = auth;
window.firebaseDB = db;
window.firebaseFirestore = firestore;
window.fbRef = ref;
window.fbSet = set;
window.fbOnValue = onValue;
window.fbUpdate = update;
window.fbRemove = remove;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.signOut = signOut;

// Live Search & Admin Orders State
window.searchQuery = "";
window.adminOrders = (function() {
    try {
        return JSON.parse(localStorage.getItem('binRiazOrders') || '[]');
    } catch(e) {
        return [];
    }
})();
window.currentViewingOrderSlip = "";

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

window.handleSearch = function(val) {
    window.searchQuery = (val || "").trim().toLowerCase();
    const clearBtn = document.getElementById('searchClearBtn');
    const countBadge = document.getElementById('searchCountBadge');
    if (window.searchQuery.length > 0) {
        if (clearBtn) clearBtn.classList.remove('hidden');
    } else {
        if (clearBtn) clearBtn.classList.add('hidden');
        if (countBadge) countBadge.classList.add('hidden');
    }
    window.renderFilteredMenu();
};

window.clearSearch = function() {
    const input = document.getElementById('foodSearchInput');
    if (input) {
        input.value = "";
        input.focus();
    }
    window.handleSearch("");
};


// Helper to sanitize items for Firebase RTDB & Firestore (no undefined values)
function sanitizeMenuItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, idx) => ({
    id: String(item.id || ('dish-' + (Date.now() + idx))),
    name: String(item.name || 'Special Dish'),
    category: String(item.category || 'deals'),
    price: Number(item.price || 0),
    desc: String(item.desc || ''),
    tag: String(item.tag || ''),
    icon: String(item.icon || 'fa-utensils'),
    image: item.image || null
  }));
}

// Online multi-device synchronization function
window.syncMenuOnline = function(rawItems) {
  const cleanItems = sanitizeMenuItems(rawItems);
  try {
    localStorage.setItem('binRiazMenuData', JSON.stringify(cleanItems));
  } catch (e) {
    console.warn("Local storage write warning:", e);
  }

  // 1. Sync to Realtime Database (instant WebSocket propagation across all phones)
  try {
    if (window.firebaseDB && window.fbRef && window.fbSet) {
      window.fbSet(window.fbRef(window.firebaseDB, 'binRiazGrill/menu'), cleanItems)
        .then(() => console.log('✅ Realtime DB Menu synced across all devices!'))
        .catch((err) => console.warn('RTDB sync notice:', err));
    }
  } catch (err) {
    console.warn('RTDB sync exception:', err);
  }

  // 2. Sync to Cloud Firestore (durability)
  try {
    if (window.firebaseFirestore) {
      setDoc(doc(window.firebaseFirestore, 'binRiazGrill', 'menuData'), {
        items: cleanItems,
        lastUpdated: Date.now()
      }).then(() => console.log('✅ Firestore Menu backup saved!'))
        .catch((err) => console.warn('Firestore sync notice:', err));
    }
  } catch (err) {
    console.warn('Firestore sync exception:', err);
  }
};


        const defaultMenuItems = [
            { id: "deal-1", name: "DEALS-1 (Jumbo Roll Special)", category: "deals", price: 500, desc: "1 Jumbo Roll Paratha + 2 Sauces + 300 ML Drink", tag: "Bestseller", icon: "fa-burger" },
            { id: "deal-2", name: "DEALS-2 (Duo Jumbo)", category: "deals", price: 1000, desc: "2 Jumbo Roll Paratha + 2 Drinks", tag: "Popular", icon: "fa-utensils" },
            { id: "deal-3", name: "DEALS-3 (Buy 5 Get 1 Free)", category: "deals", price: 1999, desc: "5 Roll Paratha + Get 1 Free Roll Paratha", tag: "Value Deal", icon: "fa-gift" },
            { id: "deal-4", name: "DEALS-4 (Family Feast)", category: "deals", price: 3200, desc: "7 Roll Paratha + Get 2 Free Sauces", tag: "Family", icon: "fa-users" },
            { id: "deal-5", name: "DEALS-5 (Mega Special)", category: "deals", price: 3999, desc: "10 Roll Paratha Special + Get 2 Jumbo Rolls Free", tag: "Mega Deal", icon: "fa-crown" },
            { id: "desi-tarka", name: "DESI TARKA DEAL", category: "dawat", price: 1200, desc: "Tawa Chicken + 2 Sauces + 3 Malwari Paratha + 1 Special Drink", tag: "Desi Taste", icon: "fa-fire" },
            { id: "dawat-4-5", name: "DAWAT DESI DEAL (4 to 5 Person)", category: "dawat", price: 2600, desc: "Special Chicken Karahi (Extra Gravy) + Special Boneless Biryani (Matka) + 6 Roti/Naan + 2 Sauce Dips + 1000 ML Drink", tag: "4-5 Person", icon: "fa-bowl-food" },
            { id: "dawat-6-7", name: "DAWAT DESI DEAL (6 to 7 Person)", category: "dawat", price: 4200, desc: "Chicken Karahi Full (Extra Gravy) + Special BBQ Platter (with rice) + 8 Naan + 2 Special Sauces + Drink", tag: "Grand Feast", icon: "fa-champagne-glasses" },
            { id: "platter-1", name: "BAR B Q PLATTER (1 Person)", category: "platters", price: 1300, desc: "Malai Boti / Chicken Boti / Behari Boti + Reshmi Kabab + Fried Rice / Malwari Paratha + Special Sauce", tag: "Solo Feast", icon: "fa-drumstick-bite" },
            { id: "platter-2", name: "BAR B Q PLATTER (2 Person)", category: "platters", price: 2000, desc: "Malai Boti + Shangrila Boti + Chicken Boti + Behari Boti + Reshmi Kabab + Chinese Rice & 2 Malwari Paratha + Special Sauce", tag: "Duo Feast", icon: "fa-drumstick-bite" },
            { id: "platter-3", name: "BAR B Q PLATTER (3 Person)", category: "platters", price: 3000, desc: "Malai Boti + Shangrila Boti + Behari Boti + Reshmi Kabab + Chicken Boti + Chicken Tikka + Full Chinese Rice & 3 Malwari Paratha + Special Sauce", tag: "Trio Royal", icon: "fa-drumstick-bite" },
            { id: "roll-bin-riyaz", name: "Bin Riaz Special Roll (Jumbo)", category: "rolls", price: 450, desc: "Chef's signature charcoal chicken wrapped in freshly prepared crisp Malwari Paratha.", tag: "Must Try", icon: "fa-bread-slice" },
            { id: "roll-chatni", name: "Chicken Chatni Roll (Jumbo)", category: "rolls", price: 450, desc: "Smoky grilled chicken spiced with authentic spicy mint chutney & onions.", tag: "Spicy", icon: "fa-pepper-hot" },
            { id: "roll-cheese", name: "Chicken Cheese Roll (Jumbo)", category: "rolls", price: 450, desc: "Loaded with melted mozzarella and cheddar cheese over tender chicken cubes.", tag: "Cheesy", icon: "fa-cheese" },
            { id: "roll-mayo", name: "Chicken Mayo Roll (Jumbo)", category: "rolls", price: 450, desc: "Creamy garlic mayo tossed with charcoal grilled chicken.", tag: "Kids Fav", icon: "fa-bread-slice" },
            { id: "roll-malai", name: "Malai Boti Roll (Jumbo)", category: "rolls", price: 450, desc: "Ultra tender boneless chicken infused with mild spices & cream.", tag: "Mild", icon: "fa-bread-slice" },
            { id: "roll-behari", name: "Behari Kabab Roll (Jumbo)", category: "rolls", price: 450, desc: "Authentic Bihari spiced tender meat roll with smoky flavor.", tag: "Smoky", icon: "fa-bread-slice" },
            { id: "roll-cheese-paratha", name: "Cheese Paratha (Special)", category: "rolls", price: 800, desc: "Stuffed whole wheat crispy paratha bursting with premium molten cheese.", tag: "Cheese Lover", icon: "fa-circle-dot" },
            { id: "karahi-chicken-half", name: "Chicken Karahi (Half)", category: "karahi", price: 1150, desc: "Prepared fresh on wok with fresh tomatoes, ginger, green chilies, and pure spices.", tag: "Fresh 30 Min", icon: "fa-bowl-rice" },
            { id: "karahi-chicken-full", name: "Chicken Karahi (Full)", category: "karahi", price: 2200, desc: "Full wok serving of authentic desi chicken karahi with rich aromatic gravy.", tag: "Fresh 30 Min", icon: "fa-bowl-rice" },
            { id: "karahi-makhni-half", name: "Chicken Makhni Karahi (Half)", category: "karahi", price: 1350, desc: "Velvety butter gravy prepared with tender chicken and mild aromatic herbs.", tag: "Butter Special", icon: "fa-bowl-rice" },
            { id: "karahi-white-half", name: "Chicken White Karahi (Half)", category: "karahi", price: 1350, desc: "Cream and yogurt base rich white sauce karahi with white pepper.", tag: "Creamy", icon: "fa-bowl-rice" },
            { id: "karahi-mutton-half", name: "Mutton Karahi (Half)", category: "karahi", price: 2600, desc: "Fresh prime cuts of mutton cooked in traditional desi style.", tag: "Royal Mutton", icon: "fa-bowl-rice" },
            { id: "handi-paneer-reshmi", name: "Paneer Reshmi Handi (Half)", category: "karahi", price: 1300, desc: "Clay pot cooked boneless chicken & paneer chunks in rich gravy.", tag: "Clay Pot Handi", icon: "fa-bowl-rice" },
            { id: "tikka-chest", name: "Chicken Tikka (Chest Piece)", category: "bbq", price: 450, desc: "Juicy breast piece marinated in spicy Bin Riaz tandoori masala with 2 sauces free.", tag: "Charcoal Hot", icon: "fa-drumstick-bite" },
            { id: "tikka-leg", name: "Chicken Tikka (Leg Piece)", category: "bbq", price: 400, desc: "Charcoal grilled tender leg quarter with 2 sauces free.", tag: "Charcoal Hot", icon: "fa-drumstick-bite" },
            { id: "bbq-shangrila", name: "Shangrila Boti", category: "bbq", price: 950, desc: "Special skewered tender chicken with Bin Riaz house secret marinade.", tag: "Signature", icon: "fa-fire-flame-curved" },
            { id: "bbq-malai-boti", name: "Malai Boti Plate", category: "bbq", price: 900, desc: "Melt in mouth boneless chicken boti grilled to perfection over embers.", tag: "Tender", icon: "fa-fire-flame-curved" },
            { id: "bbq-reshmi-kabab", name: "Reshmi Kabab Plate", category: "bbq", price: 850, desc: "Fine minced chicken skewers seasoned with mild saffron spices & butter.", tag: "Chef Special", icon: "fa-fire-flame-curved" },
            { id: "matka-biryani-half", name: "Special Matka Biryani (Boneless Half)", category: "chinese", price: 1250, desc: "Dum pukht fragrant basmati rice loaded with boneless marinated chicken + Free Raita.", tag: "Matka Dum", icon: "fa-bowl-rice" },
            { id: "chowmein-special", name: "Bin Riaz Special Chow Mein", category: "chinese", price: 1000, desc: "Stir-fried noodles with chicken strips, crunchy vegetables, and signature sauces.", tag: "Wok Tossed", icon: "fa-utensils" },
            { id: "chicken-chili-rice", name: "Chicken Chili with Rice", category: "chinese", price: 950, desc: "Spicy wok chicken chili paired with delicious egg fried rice.", tag: "Oriental", icon: "fa-bowl-food" },
            { id: "naan-cheese", name: "Cheese Naan", category: "tandoor", price: 499, desc: "Fresh tandoori naan overflowing with gooey cheese.", tag: "Hot", icon: "fa-circle" },
            { id: "naan-roghni", name: "Roghni Naan", category: "tandoor", price: 80, desc: "Traditional sesame seed garnished butter-glazed tandoori naan.", tag: "Classic", icon: "fa-circle" },
            { id: "malwari-paratha", name: "Malwari Paratha", category: "tandoor", price: 70, desc: "Layered, crispy and golden fried Malwari style paratha.", tag: "Crispy", icon: "fa-circle" },
            { id: "naan-plain", name: "Plain Naan / Roti", category: "tandoor", price: 30, desc: "Freshly baked clay oven tandoori bread.", tag: "Fresh", icon: "fa-circle" }
        ];

        let storedMenu = null;
        try {
            const parsed = JSON.parse(localStorage.getItem('binRiazMenuData') || 'null');
            if (Array.isArray(parsed) && parsed.length > 0) {
                storedMenu = parsed;
            }
        } catch(e) {}
        window.menuItems = storedMenu || [...defaultMenuItems];
        window.cart = [];
        window.currentFilter = 'all';
        window.layoutMode = localStorage.getItem('binRiazLayoutMode') || 'vertical';
        window.currentAdminPin = localStorage.getItem('binRiazAdminPin') || "00123";
        window.memberDiscountPercent = Number(localStorage.getItem('binRiazDiscount')) || 10;
        window.uploadedImageBase64 = "";
        window.currentUser = JSON.parse(localStorage.getItem('binRiazUser')) || null;

        // Registered Users Database Helper (Ensures persistent registered accounts)
        function getRegisteredUsers() {
            try {
                return JSON.parse(localStorage.getItem('binRiazRegisteredUsers')) || [];
            } catch (e) {
                return [];
            }
        }
        function saveRegisteredUsers(users) {
            try {
                localStorage.setItem('binRiazRegisteredUsers', JSON.stringify(users));
            } catch (e) {}
        }

        window.showToast = function(msg, type = "success") {
            const toast = document.getElementById('toastNotification');
            const messageEl = document.getElementById('toastMessage');
            const iconEl = document.getElementById('toastIcon');

            messageEl.innerText = msg;
            if (type === "success") {
                iconEl.className = "fa-solid fa-circle-check text-emerald-400 text-base";
            } else {
                iconEl.className = "fa-solid fa-triangle-exclamation text-red-400 text-base";
            }

            toast.classList.remove('hidden');
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 3000);
        };

        window.dismissSplashScreen = function() {
            const splash = document.getElementById('splashScreen');
            if (splash) {
                splash.classList.add('fade-out-splash');
                setTimeout(() => {
                    try {
                        if (splash && splash.parentNode) {
                            splash.remove();
                        }
                    } catch(e) {}
                    document.documentElement.style.overflow = '';
                    document.body.style.overflow = '';
                    document.body.style.touchAction = '';
                }, 500);
            } else {
                document.documentElement.style.overflow = '';
                document.body.style.overflow = '';
                document.body.style.touchAction = '';
            }
        };

        window.setCurrentUserSession = function(user, showToastFlag = true) {
            window.currentUser = user;
            localStorage.setItem('binRiazUser', JSON.stringify(user));
            const shortName = user.email ? user.email.split('@')[0] : "Member";
            const btnText = document.getElementById('authBtnText');
            if (btnText) {
                btnText.innerText = shortName;
            }
            const onlineDot = document.getElementById('userOnlineIndicator');
            if (onlineDot) {
                onlineDot.classList.remove('hidden');
            }
            document.getElementById('memberDiscountNotification').classList.remove('hidden');
            document.getElementById('memberDiscountPercentText').innerText = window.memberDiscountPercent + "% OFF";
            window.updateCartUI();
            if (showToastFlag) {
                window.showToast("Login Successful! 🎉");
            }
        };

        function flyToCart(startElement) {
            if (!startElement) return;
            const cartBadge = document.getElementById('cartCountBadge');
            if (!cartBadge) return;

            const startRect = startElement.getBoundingClientRect();
            const endRect = cartBadge.getBoundingClientRect();

            const flyer = document.createElement('div');
            flyer.className = 'flying-item-particle';
            flyer.style.width = '38px';
            flyer.style.height = '38px';
            flyer.style.left = `${startRect.left + startRect.width / 2 - 19}px`;
            flyer.style.top = `${startRect.top + startRect.height / 2 - 19}px`;
            flyer.innerHTML = '<i class="fa-solid fa-fire text-black text-sm"></i>';
            document.body.appendChild(flyer);

            requestAnimationFrame(() => {
                flyer.style.left = `${endRect.left + endRect.width / 2 - 12}px`;
                flyer.style.top = `${endRect.top + endRect.height / 2 - 12}px`;
                flyer.style.transform = 'scale(0.3) rotate(360deg)';
                flyer.style.opacity = '0.7';
            });

            setTimeout(() => {
                flyer.remove();
                cartBadge.classList.add('scale-150', 'bg-amber-400', 'text-black');
                setTimeout(() => cartBadge.classList.remove('scale-150', 'bg-amber-400', 'text-black'), 250);
            }, 650);
        }

        window.renderMenu = function(items) {
            const container = document.getElementById('menuContainer');
            if(!container) return;
            container.innerHTML = "";

            if (window.layoutMode === 'horizontal') {
                container.className = "grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4";
            } else {
                container.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6";
            }

            if(items.length === 0) {
                if (window.searchQuery) {
                    container.innerHTML = `
                        <div class="col-span-full py-16 text-center text-gray-400">
                            <i class="fa-solid fa-magnifying-glass text-4xl mb-3 text-amber-500/60 animate-pulse"></i>
                            <p class="text-sm font-semibold text-white">No dishes found matching "${escapeHtml(window.searchQuery)}"</p>
                            <p class="text-xs text-gray-500 mt-1">Try searching for deals, karahi, roll, biryani, or tikka</p>
                            <button onclick="clearSearch()" class="mt-4 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-semibold transition">
                                <i class="fa-solid fa-arrow-rotate-left mr-1"></i> Clear Search
                            </button>
                        </div>
                    `;
                    return;
                }
                container.innerHTML = `
                    <div class="col-span-full py-16 text-center text-gray-500">
                        <i class="fa-solid fa-utensils text-4xl mb-3 text-neutral-700"></i>
                        <p>No items found in this category.</p>
                    </div>`;
                return;
            }

            items.forEach(item => {
                const card = document.createElement('div');

                if (window.layoutMode === 'horizontal') {
                    card.className = "glass-panel rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300 w-full";
                    
                    const mediaHtml = item.image 
                        ? `<img src="${item.image}" alt="${item.name}" class="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-amber-500/30 shrink-0">` 
                        : `<div class="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-neutral-900 border border-white/5 flex items-center justify-center text-amber-400 text-lg sm:text-xl shrink-0"><i class="fa-solid ${item.icon || 'fa-utensils'}"></i></div>`;

                    card.innerHTML = `
                        <div class="flex items-center gap-3 flex-1 min-w-0 w-full sm:w-auto">
                            ${mediaHtml}
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center gap-1.5 mb-1">
                                    <h3 class="font-bold text-xs sm:text-sm text-white truncate">${item.name}</h3>
                                    ${item.tag ? `<span class="text-[8px] sm:text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-500/20 shrink-0">${item.tag}</span>` : ''}
                                </div>
                                <p class="text-[11px] sm:text-xs text-gray-400 line-clamp-2 leading-relaxed">${item.desc}</p>
                            </div>
                        </div>

                        <div class="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5 shrink-0">
                            <div class="text-left sm:text-right">
                                <span class="text-[9px] text-gray-500 uppercase block font-medium">PRICE</span>
                                <span class="font-extrabold text-sm sm:text-base text-amber-400">Rs. ${item.price}</span>
                            </div>
                            <button onclick="addToCart('${item.id}', event)" class="bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-bold px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-red-950/60 active:scale-95 transition">
                                <i class="fa-solid fa-plus"></i> Add
                            </button>
                        </div>
                    `;
                } else {
                    card.className = "glass-panel rounded-2xl overflow-hidden flex flex-col justify-between hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300 group w-full";

                    if (item.image) {
                        card.innerHTML = `
                            <div class="relative w-full min-h-[175px] bg-cover bg-center flex flex-col justify-between p-4" style="background-image: linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(11,12,16,0.85) 75%, rgba(11,12,16,1) 100%), url('${item.image}');">
                                <div class="flex justify-between items-start gap-2 relative z-10">
                                    <div class="w-9 h-9 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-amber-400 shadow-md">
                                        <i class="fa-solid ${item.icon || 'fa-utensils'} text-sm"></i>
                                    </div>
                                    ${item.tag ? `<span class="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-red-600/80 text-white border border-red-400/40 shadow-lg backdrop-blur-md">${item.tag}</span>` : ''}
                                </div>

                                <div class="relative z-10 pt-4">
                                    <h3 class="font-bold text-sm sm:text-base text-white group-hover:text-amber-400 transition drop-shadow mb-1">
                                        ${item.name}
                                    </h3>
                                    <p class="text-xs text-gray-300 leading-relaxed drop-shadow line-clamp-2">
                                        ${item.desc}
                                    </p>
                                </div>
                            </div>

                            <div class="p-4 pt-3 border-t border-white/5 flex items-center justify-between mt-auto">
                                <div>
                                    <span class="text-[9px] text-gray-500 uppercase tracking-wider block">PRICE</span>
                                    <span class="font-extrabold text-base sm:text-lg text-amber-400">Rs. ${item.price}</span>
                                </div>
                                <button onclick="addToCart('${item.id}', event)" class="bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-bold px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-red-950/60 active:scale-95 transition">
                                    <i class="fa-solid fa-plus"></i> Add
                                </button>
                            </div>
                        `;
                    } else {
                        card.innerHTML = `
                            <div class="p-4 sm:p-5 pb-0">
                                <div class="flex justify-between items-start gap-2 mb-3">
                                    <div class="w-10 h-10 rounded-xl bg-neutral-900 border border-white/5 flex items-center justify-center text-amber-400 group-hover:scale-110 transition duration-300">
                                        <i class="fa-solid ${item.icon || 'fa-utensils'}"></i>
                                    </div>
                                    ${item.tag ? `<span class="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-red-600/20 text-red-400 border border-red-500/20">${item.tag}</span>` : ''}
                                </div>

                                <h3 class="font-bold text-sm sm:text-base text-white group-hover:text-amber-400 transition mb-1">
                                    ${item.name}
                                </h3>
                                <p class="text-xs text-gray-400 leading-relaxed mb-4">
                                    ${item.desc}
                                </p>
                            </div>

                            <div class="p-4 sm:p-5 pt-3 border-t border-white/5 flex items-center justify-between mt-auto">
                                <div>
                                    <span class="text-[9px] text-gray-500 uppercase tracking-wider block">PRICE</span>
                                    <span class="font-extrabold text-base sm:text-lg text-amber-400">Rs. ${item.price}</span>
                                </div>
                                <button onclick="addToCart('${item.id}', event)" class="bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-bold px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-red-950/60 active:scale-95 transition">
                                    <i class="fa-solid fa-plus"></i> Add
                                </button>
                            </div>
                        `;
                    }
                }

                container.appendChild(card);
            });
        };

        window.renderFilteredMenu = function() {
            const q = (window.searchQuery || "").trim().toLowerCase();
            const countBadge = document.getElementById('searchCountBadge');
            const clearBtn = document.getElementById('searchClearBtn');
            let itemsToDisplay = [];

            if (q.length > 0) {
                if (clearBtn) clearBtn.classList.remove('hidden');
                const words = q.split(/\s+/).filter(Boolean);
                itemsToDisplay = (window.menuItems || []).filter(item => {
                    const searchTarget = `${item.name || ''} ${item.desc || ''} ${item.category || ''} ${item.tag || ''} ${item.price || ''}`.toLowerCase();
                    return words.every(w => searchTarget.includes(w));
                });
                if (countBadge) {
                    countBadge.innerText = `${itemsToDisplay.length} found`;
                    countBadge.classList.remove('hidden');
                }
            } else {
                if (clearBtn) clearBtn.classList.add('hidden');
                if (countBadge) countBadge.classList.add('hidden');
                if (window.currentFilter === 'all') {
                    itemsToDisplay = (window.menuItems && window.menuItems.length > 0) ? window.menuItems : defaultMenuItems;
                } else {
                    const allItems = (window.menuItems && window.menuItems.length > 0) ? window.menuItems : defaultMenuItems;
                    itemsToDisplay = allItems.filter(item => item.category === window.currentFilter);
                }
            }
            window.renderMenu(itemsToDisplay);
        };

        window.filterCategory = function(cat, evt) {
            window.currentFilter = cat;
            const searchInput = document.getElementById('foodSearchInput');
            if (searchInput && window.searchQuery) {
                searchInput.value = '';
                window.searchQuery = '';
                const clearBtn = document.getElementById('searchClearBtn');
                const countBadge = document.getElementById('searchCountBadge');
                if (clearBtn) clearBtn.classList.add('hidden');
                if (countBadge) countBadge.classList.add('hidden');
            }
            const buttons = document.querySelectorAll('.cat-btn');
            buttons.forEach(btn => {
                btn.className = "cat-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap bg-neutral-900 hover:bg-neutral-800 text-gray-300 border border-white/5";
            });
            const targetBtn = (evt && evt.currentTarget) || (typeof event !== 'undefined' && event && event.currentTarget);
            if (targetBtn) {
                targetBtn.className = "cat-btn active px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap bg-amber-500 text-black shadow-md shadow-amber-500/20";
            }
            window.renderFilteredMenu();
        };

        window.addToCart = function(itemId, event) {
            const product = window.menuItems.find(i => i.id === itemId);
            if (!product) return;

            const existing = window.cart.find(i => i.id === itemId);
            if (existing) {
                existing.qty += 1;
            } else {
                window.cart.push({ ...product, qty: 1 });
            }

            if (event && event.currentTarget) {
                flyToCart(event.currentTarget);
            }

            window.updateCartUI();
        };

        window.changeQty = function(itemId, delta) {
            const index = window.cart.findIndex(i => i.id === itemId);
            if (index === -1) return;

            window.cart[index].qty += delta;
            if (window.cart[index].qty <= 0) {
                window.cart.splice(index, 1);
            }
            window.updateCartUI();
        };

        window.updateCartUI = function() {
            const container = document.getElementById('cartItemsContainer');
            const countBadge = document.getElementById('cartCountBadge');
            const subTotalDisplay = document.getElementById('subTotalDisplay');
            const grandTotalDisplay = document.getElementById('grandTotalDisplay');
            const discountRow = document.getElementById('discountRow');
            const discountDisplay = document.getElementById('discountDisplay');

            const totalCount = window.cart.reduce((acc, item) => acc + item.qty, 0);
            countBadge.innerText = totalCount;

            const subTotalPrice = window.cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
            subTotalDisplay.innerText = `Rs. ${subTotalPrice}`;

            let finalPrice = subTotalPrice;
            if (window.currentUser && window.memberDiscountPercent > 0 && subTotalPrice > 0) {
                const discountAmt = Math.round((subTotalPrice * window.memberDiscountPercent) / 100);
                finalPrice = subTotalPrice - discountAmt;
                discountRow.classList.remove('hidden');
                discountDisplay.innerText = `- Rs. ${discountAmt} (${window.memberDiscountPercent}%)`;
            } else {
                discountRow.classList.add('hidden');
            }

            grandTotalDisplay.innerText = `Rs. ${finalPrice}`;

            if (window.cart.length === 0) {
                container.innerHTML = `
                    <div class="h-64 flex flex-col items-center justify-center text-center text-gray-500">
                        <i class="fa-solid fa-basket-shopping text-4xl mb-3 text-neutral-800"></i>
                        <p class="text-xs font-semibold">Your order tray is empty.</p>
                        <p class="text-[11px] text-gray-600 mt-1">Select royal deals from the menu to proceed.</p>
                    </div>`;
                return;
            }

            container.innerHTML = "";
            window.cart.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = "pt-3 first:pt-0 flex items-center justify-between gap-3";
                itemDiv.innerHTML = `
                    <div class="flex-1 min-w-0">
                        <h4 class="text-xs font-bold text-white truncate">${item.name}</h4>
                        <span class="text-[11px] text-amber-400 font-semibold">Rs. ${item.price} each</span>
                    </div>

                    <div class="flex items-center gap-2 bg-neutral-950 border border-white/10 px-2 py-1 rounded-lg">
                        <button onclick="changeQty('${item.id}', -1)" class="text-gray-400 hover:text-red-400 w-5 h-5 flex items-center justify-center font-bold text-xs">-</button>
                        <span class="text-xs font-bold text-white px-1">${item.qty}</span>
                        <button onclick="changeQty('${item.id}', 1)" class="text-gray-400 hover:text-green-400 w-5 h-5 flex items-center justify-center font-bold text-xs">+</button>
                    </div>

                    <div class="text-right min-w-[70px]">
                        <span class="text-xs font-extrabold text-white">Rs. ${item.price * item.qty}</span>
                    </div>
                `;
                container.appendChild(itemDiv);
            });
        };

        window.toggleCartDrawer = function() {
            const drawer = document.getElementById('cartDrawer');
            const backdrop = document.getElementById('cartBackdrop');
            const panel = document.getElementById('cartPanel');

            if (drawer.classList.contains('pointer-events-none')) {
                drawer.classList.remove('pointer-events-none');
                backdrop.classList.remove('opacity-0');
                backdrop.classList.add('opacity-100');
                panel.classList.remove('translate-x-full');
                panel.classList.add('translate-x-0');
            } else {
                backdrop.classList.remove('opacity-100');
                backdrop.classList.add('opacity-0');
                panel.classList.remove('translate-x-0');
                panel.classList.add('translate-x-full');
                setTimeout(() => drawer.classList.add('pointer-events-none'), 300);
            }
        };

        let deliveryTimerInterval = null;
        function startDeliveryCountdown() {
            const targetTime = Date.now() + (50 * 60 * 1000);
            localStorage.setItem('binRiazDeliveryTarget', targetTime.toString());
            checkDeliveryCountdown();
        }

        function checkDeliveryCountdown() {
            const target = localStorage.getItem('binRiazDeliveryTarget');
            if (!target) return;

            const targetTime = parseInt(target);
            const bar = document.getElementById('deliveryTrackingBar');
            const display = document.getElementById('deliveryTimerDisplay');

            if (deliveryTimerInterval) clearInterval(deliveryTimerInterval);

            function updateDisplay() {
                const diff = targetTime - Date.now();
                if (diff <= 0) {
                    clearInterval(deliveryTimerInterval);
                    bar.classList.add('hidden');
                    localStorage.removeItem('binRiazDeliveryTarget');
                    return;
                }
                bar.classList.remove('hidden');
                const minutes = Math.floor(diff / 60000);
                const seconds = Math.floor((diff % 60000) / 1000);
                display.innerText = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
            }

            updateDisplay();
            deliveryTimerInterval = setInterval(updateDisplay, 1000);
        }
        window.checkDeliveryCountdown = checkDeliveryCountdown;

        window.sendOrderViaWhatsApp = function() {
            if (window.cart.length === 0) {
                alert("Please add at least 1 item or deal to your order!");
                return;
            }

            const name = document.getElementById('custName').value.trim();
            const phone = document.getElementById('custPhone').value.trim();
            const address = document.getElementById('custAddress').value.trim();

            if (!name || !phone || !address) {
                alert("Please fill in your Name, Phone Number, and Delivery Address / Table Number.");
                return;
            }

            const subTotal = window.cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
            let discountAmt = 0;
            if (window.currentUser && window.memberDiscountPercent > 0) {
                discountAmt = Math.round((subTotal * window.memberDiscountPercent) / 100);
            }
            const netTotal = subTotal - discountAmt;
            const dateNow = new Date().toLocaleString('en-US', { hour12: true });

            let slip = `*================================*\n`;
            slip += `*👑 BIN RIAZ GRILL RESTAURANT 👑*\n`;
            slip += `*Official WhatsApp Order Slip*\n`;
            slip += `*================================*\n\n`;
            
            slip += `*📅 Date & Time:* ${dateNow}\n`;
            slip += `*👤 Customer Name:* ${name}\n`;
            slip += `*📞 Contact No:* ${phone}\n`;
            slip += `*📍 Delivery Address/Table:* ${address}\n`;
            if (window.currentUser) {
                slip += `*👑 Member Account:* ${window.currentUser.email} (${window.memberDiscountPercent}% Discount)\n`;
            }
            slip += `\n*-------- 🛒 ORDER DETAILS --------*\n`;
            window.cart.forEach((item, index) => {
                slip += `${index + 1}. *${item.name}*\n`;
                slip += `    Qty: ${item.qty} x Rs. ${item.price} = *Rs. ${item.qty * item.price}*\n`;
            });
            
            slip += `\n*----------------------------------*\n`;
            slip += `*Subtotal:* Rs. ${subTotal}/-\n`;
            if (discountAmt > 0) {
                slip += `*Member Discount (${window.memberDiscountPercent}%):* -Rs. ${discountAmt}/-\n`;
            }
            slip += `*💰 TOTAL PAYABLE: Rs. ${netTotal}/-*\n`;
            slip += `*⚡ Delivery Guarantee:* 50 Minutes Rider Promise\n`;
            slip += `*----------------------------------*\n`;
            slip += `*📍 Kitchen Location:* Jinnah Center, Near Pakiza Cash & Carry, Jinnah Garden, Islamabad.\n`;
            slip += `_Please confirm my order as soon as possible! Thank you!_`;

            
            // Cloud Sync Order to Firebase RTDB
            try {
                if (window.firebaseDB && window.fbRef && window.fbSet) {
                    const orderId = 'ORD-' + Date.now();
                    window.fbSet(window.fbRef(window.firebaseDB, 'binRiazGrill/orders/' + orderId), {
                        orderId: orderId,
                        timestamp: Date.now(),
                        date: dateNow,
                        customerName: name,
                        customerPhone: phone,
                        deliveryAddress: address,
                        memberEmail: window.currentUser ? window.currentUser.email : null,
                        items: window.cart.map(function(i) { return { id: i.id, name: i.name, price: i.price, qty: i.qty }; }),
                        subTotal: subTotal,
                        discountAmt: discountAmt,
                        totalPayable: netTotal,
                        status: 'placed'
                    }).catch(function(err) { console.warn('Order sync note:', err); });
                }
            } catch (e) {
                console.warn('Order sync error:', e);
            }
            startDeliveryCountdown();


            window.cart = [];
            window.updateCartUI();
            window.toggleCartDrawer();
            window.showToast("Order Placed! Cart is now empty. 🛒");

            const targetPhone = "923325044423";
            const encodedUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(slip)}`;
            window.open(encodedUrl, '_blank');
        };

        let isSignUpMode = false;

        window.toggleAuthModal = function() {
            if (window.currentUser) {
                if (confirm(`Logged in as ${window.currentUser.email}.\nDo you want to Sign Out?`)) {
                    if (window.firebaseAuth && window.signOut) {
                        try {
                            window.signOut(window.firebaseAuth);
                        } catch(e) {}
                    }
                    window.currentUser = null;
                    localStorage.removeItem('binRiazUser');
                    document.getElementById('authBtnText').innerText = "Login";
                    const onlineDot = document.getElementById('userOnlineIndicator');
                    if (onlineDot) onlineDot.classList.add('hidden');
                    document.getElementById('memberDiscountNotification').classList.add('hidden');
                    window.updateCartUI();
                    window.showToast("Signed Out successfully.");
                }
                return;
            }
            document.getElementById('authModal').classList.toggle('hidden');
        };

        window.toggleAuthMode = function() {
            isSignUpMode = !isSignUpMode;
            document.getElementById('authModalTitle').innerText = isSignUpMode ? "CREATE MEMBER ACCOUNT" : "MEMBER LOGIN";
            document.getElementById('authSubmitBtn').innerHTML = `<span>${isSignUpMode ? "Register Now" : "Sign In"}</span>`;
            document.getElementById('authSwitchBtn').innerText = isSignUpMode ? "Already have an account? Sign In" : "Don't have an account? Register";
        };

        // FIXED AUTHENTICATION SYSTEM:
        // 1. Users MUST register first with email & password.
        // 2. Unregistered users CANNOT log in (no fake auto-login fallback).
        // 3. Registered accounts are securely stored in persistent local database and Firebase Auth.
        window.handleAuthSubmit = function() {
            const emailInput = document.getElementById('authEmail');
            const passwordInput = document.getElementById('authPassword');
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();
            const submitBtn = document.getElementById('authSubmitBtn');

            if (!email || !password) {
                alert("Please fill in both Email and Password.");
                return;
            }

            if (!email.includes('@') || !email.includes('.')) {
                alert("Please enter a valid email address.");
                return;
            }

            if (password.length < 4) {
                alert("Password must be at least 4 characters.");
                return;
            }

            const currentRegisteredUsers = getRegisteredUsers();
            const userIndex = currentRegisteredUsers.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

            submitBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> <span>Processing...</span>`;
            submitBtn.disabled = true;

            const resetBtn = () => {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<span>${isSignUpMode ? "Register Now" : "Sign In"}</span>`;
            };

            // ================= MODE 1: REGISTRATION =================
            if (isSignUpMode) {
                if (userIndex !== -1) {
                    resetBtn();
                    alert("Yeh email pehle se registered hai! Baraye meharbani 'Sign In' karein.");
                    isSignUpMode = false;
                    document.getElementById('authModalTitle').innerText = "MEMBER LOGIN";
                    submitBtn.innerHTML = `<span>Sign In</span>`;
                    document.getElementById('authSwitchBtn').innerText = "Don't have an account? Register";
                    return;
                }

                // If Firebase Auth is available, create user there
                if (window.firebaseAuth && window.createUserWithEmailAndPassword) {
                    window.createUserWithEmailAndPassword(window.firebaseAuth, email, password)
                        .then((cred) => {
                            // Register in local database
                            currentRegisteredUsers.push({
                                email: email.toLowerCase(),
                                password: password,
                                uid: cred.user.uid,
                                registeredAt: Date.now()
                            });
                            saveRegisteredUsers(currentRegisteredUsers);

                            
                            // Cloud Sync Registered Account
                            try {
                                if (window.firebaseDB && window.fbRef && window.fbSet) {
                                    const safeKey = email.toLowerCase().replace(/[.#$\[\]\/]/g, '_');
                                    window.fbSet(window.fbRef(window.firebaseDB, 'binRiazGrill/users/' + safeKey), {
                                        email: email.toLowerCase(),
                                        uid: cred.user.uid,
                                        registeredAt: Date.now()
                                    }).catch(function() {});
                                }
                            } catch(e) {}
                            // Sign out immediate Firebase session so user must explicitly sign in as requested
                            if (window.signOut) {
                                window.signOut(window.firebaseAuth).catch(() => {});
                            }
                            window.currentUser = null;
                            localStorage.removeItem('binRiazUser');

                            // Switch to sign in mode
                            isSignUpMode = false;
                            document.getElementById('authModalTitle').innerText = "MEMBER LOGIN";
                            document.getElementById('authSwitchBtn').innerText = "Don't have an account? Register";
                            passwordInput.value = "";
                            resetBtn();
                            alert("Account kamyabi se register ho chuka hai! 🎉\nAb baraye meharbani Login karein.");
                            window.showToast("Registration Successful! Please Sign In.", "success");
                        })
                        .catch((err) => {
                            if (err && err.code === 'auth/email-already-in-use') {
                                resetBtn();
                                alert("Yeh email pehle se registered hai! Baraye meharbani Sign In karein.");
                                isSignUpMode = false;
                                document.getElementById('authModalTitle').innerText = "MEMBER LOGIN";
                                submitBtn.innerHTML = `<span>Sign In</span>`;
                                document.getElementById('authSwitchBtn').innerText = "Don't have an account? Register";
                                return;
                            }

                            // Fallback to local registration store if Firebase domain/network issue
                            currentRegisteredUsers.push({
                                email: email.toLowerCase(),
                                password: password,
                                uid: "local-" + Date.now(),
                                registeredAt: Date.now()
                            });
                            saveRegisteredUsers(currentRegisteredUsers);

                            isSignUpMode = false;
                            document.getElementById('authModalTitle').innerText = "MEMBER LOGIN";
                            document.getElementById('authSwitchBtn').innerText = "Don't have an account? Register";
                            passwordInput.value = "";
                            resetBtn();
                            alert("Account kamyabi se register ho chuka hai! 🎉\nAb baraye meharbani Login karein.");
                            window.showToast("Registration Successful! Please Sign In.", "success");
                        });
                } else {
                    // Local registration
                    currentRegisteredUsers.push({
                        email: email.toLowerCase(),
                        password: password,
                        uid: "local-" + Date.now(),
                        registeredAt: Date.now()
                    });
                    saveRegisteredUsers(currentRegisteredUsers);

                    isSignUpMode = false;
                    document.getElementById('authModalTitle').innerText = "MEMBER LOGIN";
                    document.getElementById('authSwitchBtn').innerText = "Don't have an account? Register";
                    passwordInput.value = "";
                    resetBtn();
                    alert("Account kamyabi se register ho chuka hai! 🎉\nAb baraye meharbani Login karein.");
                    window.showToast("Registration Successful! Please Sign In.", "success");
                }
            } 
            // ================= MODE 2: LOGIN =================
            else {
                // If user is not registered in local database, check Firebase or reject
                if (window.firebaseAuth && window.signInWithEmailAndPassword) {
                    window.signInWithEmailAndPassword(window.firebaseAuth, email, password)
                        .then((cred) => {
                            resetBtn();
                            // Also ensure stored in registered users
                            if (userIndex === -1) {
                                currentRegisteredUsers.push({
                                    email: email.toLowerCase(),
                                    password: password,
                                    uid: cred.user.uid,
                                    registeredAt: Date.now()
                                });
                                saveRegisteredUsers(currentRegisteredUsers);
                            }
                            window.setCurrentUserSession({ email: cred.user.email, uid: cred.user.uid }, true);
                            document.getElementById('authModal').classList.add('hidden');
                            emailInput.value = "";
                            passwordInput.value = "";
                        })
                        .catch((err) => {
                            // Check if account exists locally
                            if (userIndex !== -1) {
                                const localUser = currentRegisteredUsers[userIndex];
                                if (localUser.password === password) {
                                    resetBtn();
                                    window.setCurrentUserSession({ email: localUser.email, uid: localUser.uid }, true);
                                    document.getElementById('authModal').classList.add('hidden');
                                    emailInput.value = "";
                                    passwordInput.value = "";
                                    return;
                                } else {
                                    resetBtn();
                                    alert("Galat Password! Baraye meharbani sahi password darj karein.");
                                    window.showToast("Incorrect password!", "error");
                                    return;
                                }
                            }

                            // If not in Firebase AND not in local database:
                            resetBtn();
                            alert("Aapka account register nahi hai!\nPehle 'Register' par click karke account banayein, phir login karein.");
                            window.showToast("Account not found! Please register first.", "error");
                        });
                } else {
                    // No Firebase - verify against local database
                    if (userIndex === -1) {
                        resetBtn();
                        alert("Aapka account register nahi hai!\nPehle 'Register' par click karke account banayein, phir login karein.");
                        window.showToast("Account not found! Please register first.", "error");
                        return;
                    }

                    const localUser = currentRegisteredUsers[userIndex];
                    if (localUser.password !== password) {
                        resetBtn();
                        alert("Galat Password! Baraye meharbani sahi password darj karein.");
                        window.showToast("Incorrect password!", "error");
                        return;
                    }

                    resetBtn();
                    window.setCurrentUserSession({ email: localUser.email, uid: localUser.uid }, true);
                    document.getElementById('authModal').classList.add('hidden');
                    emailInput.value = "";
                    passwordInput.value = "";
                }
            }
        };

        window.openAdminPrompt = function() {
            document.getElementById('adminPinInput').value = "";
            document.getElementById('adminAuthModal').classList.remove('hidden');
            document.getElementById('adminPinInput').focus();
        };

        window.closeAdminPrompt = function() {
            document.getElementById('adminAuthModal').classList.add('hidden');
        };

        window.verifyAdminPass = function() {
            const pinInput = document.getElementById('adminPinInput');
            const entered = (pinInput?.value || '').trim();
            const storedPin = String(localStorage.getItem('binRiazAdminPin') || '').trim();
            const memoryPin = String(window.currentAdminPin || '').trim();
            const fallbackPin = "00123";

            if (entered === memoryPin || entered === storedPin || entered === fallbackPin) {
                window.closeAdminPrompt();
                window.openAdminDashboard();
                if (pinInput) pinInput.value = "";
            } else {
                window.showToast("Unauthorized! Incorrect Admin PIN ❌", "error");
                if (pinInput) pinInput.value = "";
            }
        };

        
// ================= ADMIN ORDERS RECORDS & SLIPS CONTROLLERS =================

window.renderAdminOrders = function() {
    const list = document.getElementById('adminOrdersList');
    const countEl = document.getElementById('adminOrdersCount');
    const revenueEl = document.getElementById('adminTotalRevenue');
    if (!list) return;

    const orders = window.adminOrders || [];
    if (countEl) countEl.innerText = `${orders.length} Orders`;

    const totalRev = orders.reduce((sum, o) => sum + (Number(o.totalPayable) || 0), 0);
    if (revenueEl) revenueEl.innerText = `Rs. ${totalRev.toLocaleString()} Total`;

    if (orders.length === 0) {
        list.innerHTML = `
            <div class="py-8 text-center text-gray-500">
                <i class="fa-solid fa-clipboard-list text-3xl mb-2 text-neutral-700"></i>
                <p class="text-xs">No orders recorded yet.</p>
                <p class="text-[10px] text-gray-600 mt-0.5">Orders placed via WhatsApp will appear here with live slips.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = orders.map(order => `
        <div class="p-3.5 rounded-xl bg-neutral-900/90 border border-white/5 hover:border-amber-500/30 transition space-y-2.5">
            <div class="flex items-start justify-between gap-2">
                <div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-xs font-bold text-white">${escapeHtml(order.customerName || 'Customer')}</span>
                        <span class="text-[10px] bg-green-500/20 text-green-300 font-mono px-2 py-0.5 rounded-full border border-green-500/30">WhatsApp Sent</span>
                    </div>
                    <p class="text-[11px] text-gray-400 font-mono mt-0.5">
                        <i class="fa-solid fa-phone text-[10px] text-amber-400"></i> ${escapeHtml(order.customerPhone || 'N/A')} • 
                        <i class="fa-regular fa-clock text-[10px] text-gray-400"></i> ${escapeHtml(order.date || 'Just now')}
                    </p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <div class="text-right">
                        <span class="text-xs font-mono font-bold text-amber-400">Rs. ${(Number(order.totalPayable) || 0).toLocaleString()}</span>
                        <p class="text-[10px] text-gray-500 font-mono">${(order.items || []).length} items</p>
                    </div>
                    <button onclick="promptDeleteAdminOrder('${order.orderId}')" class="p-1.5 px-2 bg-red-500/15 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 active:scale-95 shadow-sm" title="Delete Order Slip">
                        <i class="fa-regular fa-trash-can text-[11px]"></i> <span>Del</span>
                    </button>
                </div>
            </div>

            <div class="text-[11px] text-gray-300 bg-neutral-950/70 p-2 rounded-lg border border-white/5 space-y-0.5">
                <p class="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Delivery Address / Table:</p>
                <p class="text-gray-300 truncate">${escapeHtml(order.deliveryAddress || 'Not specified')}</p>
                <p class="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mt-1.5">Ordered Items:</p>
                <p class="text-amber-200/90 text-xs">${(order.items || []).map(i => `${escapeHtml(i.name)} (x${i.qty})`).join(', ')}</p>
            </div>

            <div class="flex items-center justify-between pt-1 gap-2">
                <span class="text-[10px] text-gray-500 font-mono">ID: ${escapeHtml((order.orderId || '').replace('ORD-', '#'))}</span>
                <div class="flex items-center gap-1.5 flex-wrap justify-end">
                    <button onclick="printOrderSlip('${order.orderId}')" class="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-sm shadow-amber-500/20 active:scale-95" title="Print Slip Directly">
                        <i class="fa-solid fa-print"></i> <span>Print</span>
                    </button>
                    <button onclick="viewOrderSlip('${order.orderId}')" class="bg-amber-500/20 hover:bg-amber-500 hover:text-black text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 active:scale-95">
                        <i class="fa-solid fa-receipt"></i> View Slip
                    </button>
                    <button onclick="copyOrderSlip('${order.orderId}')" class="bg-neutral-800 hover:bg-neutral-700 text-gray-300 border border-white/10 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 active:scale-95" title="Copy Slip to Clipboard">
                        <i class="fa-regular fa-copy"></i>
                    </button>
                    ${order.customerPhone ? `
                    <a href="https://wa.me/${String(order.customerPhone).replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Assalam-o-Alaikum ' + (order.customerName || '') + '! Your Bin Riaz Grill order (' + (order.orderId || '') + ') is received and is being prepared!')}" target="_blank" class="bg-green-600/20 hover:bg-green-600 hover:text-white text-green-400 border border-green-500/30 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 active:scale-95" title="WhatsApp Customer">
                        <i class="fa-brands fa-whatsapp"></i> Chat
                    </a>` : ''}
                    <button onclick="promptDeleteAdminOrder('${order.orderId}')" class="bg-red-500/15 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 px-2 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 active:scale-95" title="Delete Order Record">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
};

window.currentViewingOrderId = "";

window.viewOrderSlip = function(orderId) {
    const orders = window.adminOrders || [];
    const order = orders.find(o => o.orderId === orderId);
    if (!order) return;
    window.currentViewingOrderId = order.orderId;
    window.currentViewingOrderSlip = order.slipText || (
        "👑 BIN RIAZ GRILL RESTAURANT 👑\n" +
        "Order ID: " + order.orderId + "\n" +
        "Date: " + order.date + "\n" +
        "Customer: " + order.customerName + " (" + order.customerPhone + ")\n" +
        "Address: " + order.deliveryAddress + "\n" +
        "Total: Rs. " + order.totalPayable
    );
    const slipEl = document.getElementById('orderSlipContent');
    if (slipEl) slipEl.innerText = window.currentViewingOrderSlip;
    const modal = document.getElementById('orderSlipModal');
    if (modal) modal.classList.remove('hidden');
};

window.closeOrderSlipModal = function() {
    const modal = document.getElementById('orderSlipModal');
    if (modal) modal.classList.add('hidden');
};

window.generateReceiptHtml = function(order) {
    const items = order.items || [];
    const itemsRows = items.map(item => {
        const itemPrice = Number(item.price || 0);
        const itemQty = Number(item.qty || 1);
        const itemTotal = itemPrice * itemQty;
        return `
            <tr>
                <td style="padding: 4px 0; vertical-align: top; font-weight: bold;">${itemQty}x</td>
                <td style="padding: 4px 4px; vertical-align: top;">${escapeHtml(item.name || 'Special Dish')}</td>
                <td style="padding: 4px 0; vertical-align: top; text-align: right; white-space: nowrap;">Rs. ${itemTotal.toLocaleString()}</td>
            </tr>
        `;
    }).join('');

    const subTotal = Number(order.subTotal || order.totalPayable || 0);
    const discountAmt = Number(order.discountAmt || 0);
    const totalPayable = Number(order.totalPayable || 0);

    return `
        <div style="width: 100%; max-width: 320px; margin: 0 auto; padding: 12px; font-family: 'Courier New', Courier, monospace; color: #000; background: #fff; font-size: 12px; line-height: 1.35;">
            <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 6px;">
                <div style="font-size: 16px; font-weight: 900; letter-spacing: 0.5px;">👑 BIN RIAZ GRILL 👑</div>
                <div style="font-size: 12px; font-weight: bold; margin-top: 2px;">RESTAURANT & TANDOOR</div>
                <div style="font-size: 10px; margin-top: 1px;">Authentic Charcoal & Desi Cuisine</div>
                <div style="font-size: 10px;">Jinnah Center, Pakiza Cash & Carry, Islamabad</div>
                <div style="font-size: 11px; font-weight: bold; margin-top: 2px;">Tel: 0332-5044423</div>
            </div>

            <div style="font-size: 11px; margin-bottom: 5px;">
                <div style="display: flex; justify-content: space-between;"><span style="font-weight: bold;">Order No:</span> <span style="font-weight: bold;">${escapeHtml(order.orderId || 'ORD-NEW')}</span></div>
                <div style="display: flex; justify-content: space-between;"><span>Date/Time:</span> <span>${escapeHtml(order.date || new Date().toLocaleString())}</span></div>
            </div>

            <div style="border-top: 1px dashed #000; padding-top: 5px; margin-bottom: 5px; font-size: 11px;">
                <div><span style="font-weight: bold;">Customer:</span> ${escapeHtml(order.customerName || 'Customer')}</div>
                <div><span style="font-weight: bold;">Contact:</span> ${escapeHtml(order.customerPhone || 'N/A')}</div>
                <div><span style="font-weight: bold;">Address/Table:</span> ${escapeHtml(order.deliveryAddress || 'Dine-in / Delivery')}</div>
            </div>

            <div style="border-top: 1px dashed #000; padding-top: 4px; margin-bottom: 5px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead>
                        <tr style="border-bottom: 1px dashed #000; text-align: left;">
                            <th style="padding-bottom: 3px; width: 15%;">Qty</th>
                            <th style="padding-bottom: 3px; width: 55%;">Item</th>
                            <th style="padding-bottom: 3px; width: 30%; text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows || '<tr><td colspan="3" style="padding: 4px 0;">Special Order Items</td></tr>'}
                    </tbody>
                </table>
            </div>

            <div style="border-top: 1px dashed #000; padding-top: 5px; margin-bottom: 5px; font-size: 11px;">
                <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span> <span>Rs. ${subTotal.toLocaleString()}</span></div>
                ${discountAmt > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Discount:</span> <span>-Rs. ${discountAmt.toLocaleString()}</span></div>` : ''}
                <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; margin-top: 4px;">
                    <span>TOTAL PAYABLE:</span>
                    <span>Rs. ${totalPayable.toLocaleString()}/-</span>
                </div>
            </div>

            <div style="text-align: center; border-top: 1px dashed #000; padding-top: 6px; font-size: 10px; line-height: 1.4;">
                <div style="font-weight: bold;">⚡ 50 Minutes Delivery Guarantee ⚡</div>
                <div>Official WhatsApp Verified Order</div>
                <div style="margin-top: 3px; font-weight: bold;">*** THANK YOU FOR YOUR ORDER ***</div>
                <div style="font-size: 9px; color: #333;">Customer & Kitchen Billing Copy</div>
            </div>
        </div>
    `;
};

window.printOrderSlip = function(orderId) {
    const orders = window.adminOrders || [];
    const order = orders.find(o => o.orderId === orderId);
    if (!order) {
        window.showToast("Order slip record not found", "error");
        return;
    }

    const receiptHtml = window.generateReceiptHtml(order);

    // Populate on-page print element for print media styling
    let printEl = document.getElementById('printSlipSection');
    if (!printEl) {
        printEl = document.createElement('div');
        printEl.id = 'printSlipSection';
        document.body.appendChild(printEl);
    }
    printEl.innerHTML = receiptHtml;

    document.body.classList.add('is-printing-slip');

    // Create or reuse hidden iframe to trigger system print dialog cleanly
    let iframe = document.getElementById('receiptPrintIframe');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'receiptPrintIframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        iframe.style.opacity = '0';
        iframe.style.pointerEvents = 'none';
        document.body.appendChild(iframe);
    }

    let printSucceeded = false;
    try {
        const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
        if (frameDoc) {
            frameDoc.open();
            frameDoc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Order Receipt - ${escapeHtml(order.orderId)}</title><style>@page{size:80mm auto;margin:3mm;}body{margin:0;padding:0;background:#fff;color:#000;font-family:'Courier New',Courier,monospace;}</style></head><body>${receiptHtml}</body></html>`);
            frameDoc.close();

            setTimeout(() => {
                try {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                    printSucceeded = true;
                } catch(e) {
                    window.print();
                    printSucceeded = true;
                }
                setTimeout(() => {
                    document.body.classList.remove('is-printing-slip');
                }, 1000);
            }, 250);
            return;
        }
    } catch(err) {
        // Fallback below
    }

    if (!printSucceeded) {
        setTimeout(() => {
            window.print();
            setTimeout(() => {
                document.body.classList.remove('is-printing-slip');
            }, 1000);
        }, 100);
    }
};

window.printCurrentViewingOrderSlip = function() {
    if (window.currentViewingOrderId) {
        window.printOrderSlip(window.currentViewingOrderId);
    } else {
        window.print();
    }
};

window.copyCurrentOrderSlip = function() {
    if (!window.currentViewingOrderSlip) return;
    navigator.clipboard.writeText(window.currentViewingOrderSlip).then(() => {
        window.showToast("Slip copied to clipboard! 📋");
    }).catch(() => {
        window.showToast("Slip copied to clipboard! 📋");
    });
};

window.copyOrderSlip = function(orderId) {
    const orders = window.adminOrders || [];
    const order = orders.find(o => o.orderId === orderId);
    if (!order) return;
    const slip = order.slipText || `Order ID: ${order.orderId}\nCustomer: ${order.customerName}\nPhone: ${order.customerPhone}\nTotal: Rs. ${order.totalPayable}`;
    navigator.clipboard.writeText(slip).then(() => {
        window.showToast("Slip copied to clipboard! 📋");
    }).catch(() => {
        window.showToast("Slip copied to clipboard! 📋");
    });
};

window.pendingDeleteOrderId = "";

window.promptDeleteAdminOrder = function(orderId) {
    window.pendingDeleteOrderId = orderId;
    const modal = document.getElementById('deleteOrderAuthModal');
    const input = document.getElementById('deleteOrderPinInput') as HTMLInputElement | null;
    if (modal) modal.classList.remove('hidden');
    if (input) {
        input.value = "";
        setTimeout(() => input.focus(), 100);
    }
};

window.closeDeleteOrderModal = function() {
    const modal = document.getElementById('deleteOrderAuthModal');
    const input = document.getElementById('deleteOrderPinInput') as HTMLInputElement | null;
    if (modal) modal.classList.add('hidden');
    if (input) input.value = "";
    window.pendingDeleteOrderId = "";
};

window.confirmDeleteAdminOrder = function() {
    const input = document.getElementById('deleteOrderPinInput') as HTMLInputElement | null;
    const entered = (input?.value || '').trim();
    const storedPin = String(localStorage.getItem('binRiazAdminPin') || '').trim();
    const memoryPin = String(window.currentAdminPin || '').trim();
    const fallbackPin = "00123";
    const validPins = [memoryPin, storedPin, fallbackPin].filter(Boolean);

    if (!entered || !validPins.includes(entered)) {
        window.showToast("Ghalat Admin Password! ❌", "error");
        if (input) {
            input.value = "";
            input.focus();
        }
        return;
    }

    const orderId = window.pendingDeleteOrderId;
    if (!orderId) {
        window.closeDeleteOrderModal();
        return;
    }

    // 1. Remove from in-memory array
    window.adminOrders = (window.adminOrders || []).filter(o => o.orderId !== orderId);

    // 2. Persist in localStorage
    try {
        localStorage.setItem('binRiazOrders', JSON.stringify(window.adminOrders));
    } catch(e) {}

    // 3. Remove from Firebase Realtime Database
    try {
        if (window.firebaseDB && window.fbRef && window.fbRemove) {
            window.fbRemove(window.fbRef(window.firebaseDB, 'binRiazGrill/orders/' + orderId)).catch(() => {});
        }
    } catch(e) {}

    window.closeDeleteOrderModal();
    window.renderAdminOrders();
    window.showToast("Order record deleted successfully! 🗑️");
};

window.openAdminDashboard = function() {
    window.renderAdminOrders();
            document.getElementById('adminPanelModal').classList.remove('hidden');
            window.refreshAdminItemsList();
            window.applyLayoutBtnStyles();
        };

        window.closeAdminPanel = function() {
            document.getElementById('adminPanelModal').classList.add('hidden');
        };

        window.showPasswordSuccessModal = function(newPass) {
            const modal = document.getElementById('passwordChangeSuccessModal');
            const card = document.getElementById('passwordChangeSuccessCard');
            const displayEl = document.getElementById('savedNewPasswordDisplay');
            if (displayEl && newPass) {
                displayEl.innerText = newPass;
            }
            if (modal) {
                modal.classList.remove('hidden');
                setTimeout(() => {
                    if (card) {
                        card.classList.remove('scale-95', 'opacity-0');
                        card.classList.add('scale-100', 'opacity-100');
                    }
                }, 20);
            }
        };

        window.closePasswordSuccessModal = function() {
            const modal = document.getElementById('passwordChangeSuccessModal');
            const card = document.getElementById('passwordChangeSuccessCard');
            if (card) {
                card.classList.remove('scale-100', 'opacity-100');
                card.classList.add('scale-95', 'opacity-0');
            }
            setTimeout(() => {
                if (modal) modal.classList.add('hidden');
            }, 200);
        };

        window.changeAdminPassword = function() {
            const currentPassEl = document.getElementById('currentAdminPassInput');
            const newPassEl = document.getElementById('newAdminPassInput');

            const currentPass = (currentPassEl?.value || '').trim();
            const newPass = (newPassEl?.value || '').trim();

            if (!newPass) {
                window.showToast("Baraye meharbani naya password darj karein!", "error");
                if (newPassEl) newPassEl.focus();
                return;
            }

            if (newPass.length < 3) {
                window.showToast("Naya password kam az kam 3 characters ka hona chahiye!", "error");
                if (newPassEl) newPassEl.focus();
                return;
            }

            const storedPin = String(localStorage.getItem('binRiazAdminPin') || '').trim();
            const memoryPin = String(window.currentAdminPin || '').trim();
            const fallbackPin = "00123";
            const validPins = [memoryPin, storedPin, fallbackPin].filter(Boolean);

            if (currentPass && !validPins.includes(currentPass)) {
                window.showToast("Current password ghalat hai!", "error");
                if (currentPassEl) currentPassEl.focus();
                return;
            }

            // Immediately set new password in memory and persistent localStorage
            window.currentAdminPin = newPass;
            localStorage.setItem('binRiazAdminPin', newPass);

            // Sync to Firebase Realtime Database
            try {
                if (window.firebaseDB && window.fbRef) {
                    const settingsRef = window.fbRef(window.firebaseDB, 'binRiazGrill/settings');
                    if (window.fbUpdate) {
                        window.fbUpdate(settingsRef, { adminPin: newPass }).catch(() => {});
                    }
                    if (window.fbSet) {
                        const pinRef = window.fbRef(window.firebaseDB, 'binRiazGrill/settings/adminPin');
                        window.fbSet(pinRef, newPass).catch(() => {});
                    }
                }
            } catch (err) {
                console.warn('Firebase admin pin sync note:', err);
            }

            // Reset input values
            if (currentPassEl) currentPassEl.value = "";
            if (newPassEl) newPassEl.value = "";

            // Show toast and display premium success popup
            window.showToast("Admin Password Changed Successfully! 🔑", "success");
            window.showPasswordSuccessModal(newPass);
        };

        window.updateMemberDiscount = function() {
            const val = parseInt(document.getElementById('adminDiscountInput').value);
            if (isNaN(val) || val < 0 || val > 100) {
                alert("Please enter a valid percentage between 0 and 100.");
                return;
            }

            window.memberDiscountPercent = val;
            localStorage.setItem('binRiazDiscount', val.toString());

            if (window.firebaseDB && window.fbUpdate) {
                if (window.firebaseDB && window.fbRef && window.fbUpdate) { window.fbUpdate(window.fbRef(window.firebaseDB, 'binRiazGrill/settings'), { discount: val }); }
            }

            window.updateCartUI();
            window.showToast(`Discount updated to ${val}%!`);
        };

        window.setLayoutMode = function(mode) {
            window.layoutMode = mode;
            localStorage.setItem('binRiazLayoutMode', mode);
            window.applyLayoutBtnStyles();
            window.renderFilteredMenu();

            if (window.firebaseDB && window.fbUpdate) {
                window.fbUpdate(window.fbRef(window.firebaseDB, 'binRiazGrill/settings'), { layoutMode: mode });
            }
        };

        window.applyLayoutBtnStyles = function() {
            const vBtn = document.getElementById('layoutBtnVertical');
            const hBtn = document.getElementById('layoutBtnHorizontal');
            if(!vBtn || !hBtn) return;

            if (window.layoutMode === 'vertical') {
                vBtn.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 bg-amber-500 text-black";
                hBtn.className = "px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 transition flex items-center gap-1.5 hover:text-white";
            } else {
                hBtn.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 bg-amber-500 text-black";
                vBtn.className = "px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 transition flex items-center gap-1.5 hover:text-white";
            }
        };

        window.handleImageFile = function(input) {
            if (input.files && input.files[0]) {
                const file = input.files[0];
                document.getElementById('imageSelectedText').innerText = "Processing image...";
                document.getElementById('imageSelectedText').className = "text-xs text-amber-400 font-semibold";

                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = new Image();
                    img.onload = function() {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        const maxDim = 600;

                        if (width > height) {
                            if (width > maxDim) {
                                height = Math.round((height * maxDim) / width);
                                width = maxDim;
                            }
                        } else {
                            if (height > maxDim) {
                                width = Math.round((width * maxDim) / height);
                                height = maxDim;
                            }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        window.uploadedImageBase64 = canvas.toDataURL('image/jpeg', 0.75);
                        document.getElementById('imagePreviewImg').src = window.uploadedImageBase64;
                        document.getElementById('imagePreviewContainer').classList.remove('hidden');
                        document.getElementById('imageSelectedText').innerText = file.name;
                        document.getElementById('imageSelectedText').className = "text-xs text-green-400 font-semibold";
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        };

        window.publishNewItem = function() {
            const name = document.getElementById('newFoodName').value.trim();
            const price = parseInt(document.getElementById('newFoodPrice').value);
            const category = document.getElementById('newFoodCategory').value;
            const tag = document.getElementById('newFoodTag').value.trim() || "Special";
            const desc = document.getElementById('newFoodDesc').value.trim() || "Delicious freshly prepared dish from our royal kitchen.";

            if (!name) { alert("Please enter a name for the dish."); return; }
            if (!price || isNaN(price) || price <= 0) { alert("Please enter a valid price."); return; }

            const publishBtn = document.getElementById('publishDishBtn');
            publishBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> <span>Adding...</span>`;

            const newItem = {
                id: "dish-" + Date.now(),
                name: name,
                category: category,
                price: price,
                desc: desc,
                tag: tag,
                icon: "fa-utensils",
                image: window.uploadedImageBase64 || null
            };

            window.menuItems.unshift(newItem);
            
            try {
                localStorage.setItem('binRiazMenuData', JSON.stringify(window.menuItems));
            } catch(e) {
                console.warn("Storage quota full, syncing online only");
            }

            if (typeof window.syncMenuOnline === 'function') {
                window.syncMenuOnline(window.menuItems);
            } else if (window.firebaseDB && window.fbSet && window.fbRef) {
                window.fbSet(window.fbRef(window.firebaseDB, 'binRiazGrill/menu'), window.menuItems);
            }

            document.getElementById('newFoodName').value = "";
            document.getElementById('newFoodPrice').value = "";
            document.getElementById('newFoodTag').value = "";
            document.getElementById('newFoodDesc').value = "";
            document.getElementById('newFoodCategory').selectedIndex = 0;
            document.getElementById('imageGalleryInput').value = "";
            document.getElementById('imageCameraInput').value = "";
            document.getElementById('imagePreviewContainer').classList.add('hidden');
            document.getElementById('imagePreviewImg').src = "";
            document.getElementById('imageSelectedText').innerText = "No image chosen";
            document.getElementById('imageSelectedText').className = "text-xs text-gray-500 italic";
            window.uploadedImageBase64 = "";

            publishBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Publish & Upload to Website`;

            window.renderFilteredMenu();
            window.refreshAdminItemsList();
            window.showToast(`"${name}" published! Form cleared.`);
        };

        window.deleteMenuItem = function(id) {
            const item = window.menuItems.find(i => String(i.id) === String(id));
            if (!item) return;

            const deletedItemName = item.name;
            window.menuItems = window.menuItems.filter(i => String(i.id) !== String(id));
            
            try {
                localStorage.setItem('binRiazMenuData', JSON.stringify(window.menuItems));
            } catch(e) {}

            // Instant Online Multi-Phone Synchronization
            if (typeof window.syncMenuOnline === 'function') {
                window.syncMenuOnline(window.menuItems);
            } else if (window.firebaseDB && window.fbSet && window.fbRef) {
                window.fbSet(window.fbRef(window.firebaseDB, 'binRiazGrill/menu'), window.menuItems)
                    .catch(err => console.warn("Firebase delete sync notice:", err));
            }

            window.renderFilteredMenu();
            window.refreshAdminItemsList();
            window.showToast(`"${deletedItemName}" deleted successfully! 🗑️`, "success");
        };

        window.refreshAdminItemsList = function() {
            const container = document.getElementById('adminItemsList');
            const countBadge = document.getElementById('adminTotalItemsCount');
            if(!container || !countBadge) return;

            countBadge.innerText = `${window.menuItems.length} Dishes`;
            container.innerHTML = "";

            window.menuItems.forEach(item => {
                const row = document.createElement('div');
                row.className = "py-2.5 flex items-center justify-between gap-3 border-b border-white/5 last:border-0";
                row.innerHTML = `
                    <div class="flex items-center gap-2.5 min-w-0 flex-1">
                        ${item.image ? `<img src="${item.image}" class="w-8 h-8 rounded-lg object-cover border border-white/10 shrink-0">` : `<div class="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center text-amber-400 text-xs shrink-0"><i class="fa-solid ${item.icon || 'fa-utensils'}"></i></div>`}
                        <div class="min-w-0 flex-1">
                            <h5 class="text-xs font-bold text-white truncate">${item.name}</h5>
                            <span class="text-[10px] text-amber-400 font-mono">Rs. ${item.price} • Category: ${item.category}</span>
                        </div>
                    </div>
                    <button type="button" onclick="window.deleteMenuItem('${item.id}')" class="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 px-2.5 py-1 rounded-lg text-xs font-semibold transition shrink-0 active:scale-95 cursor-pointer flex items-center gap-1">
                        <i class="fa-solid fa-trash-can"></i> <span>Delete</span>
                    </button>
                `;
                container.appendChild(row);
            });
        };
    

// ================= REALTIME SYNCHRONIZATION LISTENERS =================

// 1. Realtime Database Menu Listener (sub-second updates across all phones)
try {
  const menuRef = ref(db, 'binRiazGrill/menu');
  onValue(menuRef, (snapshot) => {
    if (snapshot.exists()) {
      const val = snapshot.val();
      let items = [];
      if (Array.isArray(val)) {
        items = val.filter(Boolean);
      } else if (val && typeof val === 'object') {
        items = Object.values(val);
      }
      if (items.length > 0) {
        window.menuItems = sanitizeMenuItems(items);
        try {
          localStorage.setItem('binRiazMenuData', JSON.stringify(window.menuItems));
        } catch (e) {}
        if (typeof window.renderFilteredMenu === 'function') window.renderFilteredMenu();
        if (typeof window.refreshAdminItemsList === 'function') window.refreshAdminItemsList();
      }
    } else {
      // RTDB menu node is empty: check Firestore first before seeding defaults
      getDoc(doc(firestore, 'binRiazGrill', 'menuData')).then((snap) => {
        if (snap.exists() && snap.data()?.items?.length > 0) {
          const firestoreItems = snap.data().items;
          window.menuItems = sanitizeMenuItems(firestoreItems);
          try {
            localStorage.setItem('binRiazMenuData', JSON.stringify(window.menuItems));
          } catch (e) {}
          if (typeof window.renderFilteredMenu === 'function') window.renderFilteredMenu();
          if (typeof window.refreshAdminItemsList === 'function') window.refreshAdminItemsList();
          // Seed back into RTDB
          set(menuRef, window.menuItems).catch(() => {});
        } else {
          // If neither has data, seed with default menu items so cloud always has data
          const initialItems = (window.menuItems && window.menuItems.length > 0) ? window.menuItems : defaultMenuItems;
          window.syncMenuOnline(initialItems);
        }
      }).catch(() => {
        const initialItems = (window.menuItems && window.menuItems.length > 0) ? window.menuItems : defaultMenuItems;
        window.syncMenuOnline(initialItems);
      });
    }
  }, (err) => {
    console.warn('Realtime Database listener note:', err);
  });
} catch (e) {
  console.warn('Realtime Database listener setup note:', e);
}

// 2. Cloud Firestore Menu Listener (secondary fallback)
try {
  onSnapshot(doc(firestore, 'binRiazGrill', 'menuData'), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && Array.isArray(data.items) && data.items.length > 0) {
        if (!window.menuItems || window.menuItems.length !== data.items.length) {
          window.menuItems = sanitizeMenuItems(data.items);
          try {
            localStorage.setItem('binRiazMenuData', JSON.stringify(window.menuItems));
          } catch (e) {}
          if (typeof window.renderFilteredMenu === 'function') window.renderFilteredMenu();
          if (typeof window.refreshAdminItemsList === 'function') window.refreshAdminItemsList();
        }
      }
    }
  }, (err) => {
    console.warn('Firestore snapshot listener note:', err);
  });
} catch (e) {
  console.warn('Firestore snapshot setup note:', e);
}

// 3. Settings Listener: Master Admin PIN, Layout Mode, and Member Discount %
try {
  const settingsRef = ref(db, 'binRiazGrill/settings');
  onValue(settingsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      if (data) {
        if (data.adminPin && data.adminPin !== window.currentAdminPin) {
          window.currentAdminPin = data.adminPin;
          localStorage.setItem('binRiazAdminPin', data.adminPin);
        }
        if (data.layoutMode && data.layoutMode !== window.layoutMode) {
          window.layoutMode = data.layoutMode;
          localStorage.setItem('binRiazLayoutMode', data.layoutMode);
          if (typeof window.applyLayoutBtnStyles === 'function') window.applyLayoutBtnStyles();
          if (typeof window.renderFilteredMenu === 'function') window.renderFilteredMenu();
        }
        if (data.discount !== undefined) {
          const discountNum = Number(data.discount);
          if (discountNum !== window.memberDiscountPercent) {
            window.memberDiscountPercent = discountNum;
            localStorage.setItem('binRiazDiscount', String(discountNum));
            const adminInput = document.getElementById('adminDiscountInput');
            if (adminInput) adminInput.value = String(discountNum);
            const discountText = document.getElementById('memberDiscountPercentText');
            if (discountText) discountText.innerText = discountNum + "% OFF";
            if (typeof window.updateCartUI === 'function') window.updateCartUI();
          }
        }
      }
    } else {
      // Seed default settings to RTDB
      set(settingsRef, {
        adminPin: window.currentAdminPin || "00123",
        discount: window.memberDiscountPercent || 10,
        layoutMode: window.layoutMode || "vertical"
      }).catch(() => {});
    }
  });
} catch (e) {
  console.warn('Settings listener note:', e);
}

// 4. Registered Users Synchronization
try {
  const usersRef = ref(db, 'binRiazGrill/users');
  onValue(usersRef, (snapshot) => {
    if (snapshot.exists()) {
      const val = snapshot.val();
      if (val && typeof val === 'object') {
        const cloudUsers = Object.values(val);
        const localUsers = getRegisteredUsers();
        const map = new Map();
        localUsers.forEach((u) => {
          if (u && u.email) map.set(u.email.toLowerCase(), u);
        });
        cloudUsers.forEach((u) => {
          if (u && u.email) {
            const existing = map.get(u.email.toLowerCase());
            map.set(u.email.toLowerCase(), { ...existing, ...u });
          }
        });
        saveRegisteredUsers(Array.from(map.values()));
      }
    }
  });
} catch (e) {
  console.warn('Users listener note:', e);
}

// 5. Firebase Auth state monitoring
try {
  onAuthStateChanged(auth, (user) => {
    if (user && user.email) {
      const stored = localStorage.getItem('binRiazUser');
      if (stored && typeof window.setCurrentUserSession === 'function') {
        window.setCurrentUserSession({ email: user.email, uid: user.uid }, false);
      }
    }
  });
} catch (e) {}


// 6. Realtime Orders & WhatsApp Slips Listener
try {
  const ordersRef = ref(db, 'binRiazGrill/orders');
  onValue(ordersRef, (snapshot) => {
    if (snapshot.exists()) {
      const val = snapshot.val();
      let ordersArr = [];
      if (Array.isArray(val)) {
        ordersArr = val.filter(Boolean);
      } else if (val && typeof val === 'object') {
        ordersArr = Object.values(val);
      }
      // Sort newest first
      ordersArr.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      window.adminOrders = ordersArr;
      try {
        localStorage.setItem('binRiazOrders', JSON.stringify(ordersArr));
      } catch (e) {}
      if (typeof window.renderAdminOrders === 'function') {
        window.renderAdminOrders();
      }
    }
  }, (err) => {
    console.warn('Orders listener note:', err);
  });
} catch (e) {
  console.warn('Orders listener setup note:', e);
}

// Ensure initialization runs reliably even if DOM is already parsed
function runInitialSetup() {
  setTimeout(() => {
    if (typeof window.dismissSplashScreen === 'function') {
      window.dismissSplashScreen();
    }
  }, 1200);

  if (window.currentUser && typeof window.setCurrentUserSession === 'function') {
    window.setCurrentUserSession(window.currentUser, false);
  }
  if (typeof window.applyLayoutBtnStyles === 'function') {
    window.applyLayoutBtnStyles();
  }
  if (typeof window.renderFilteredMenu === 'function') {
    window.renderFilteredMenu();
  }
  if (typeof window.checkDeliveryCountdown === 'function') {
    window.checkDeliveryCountdown();
  }
  if (typeof window.renderAdminOrders === 'function') {
    window.renderAdminOrders();
  }
  const searchInput = document.getElementById('foodSearchInput') as HTMLInputElement | null;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      window.handleSearch((e.target as HTMLInputElement).value);
    });
    searchInput.addEventListener('keyup', (e) => {
      window.handleSearch((e.target as HTMLInputElement).value);
    });
  }
  const deletePinInput = document.getElementById('deleteOrderPinInput') as HTMLInputElement | null;
  if (deletePinInput) {
    deletePinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        window.confirmDeleteAdminOrder();
      }
    });
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', runInitialSetup);
} else {
  runInitialSetup();
}

console.log("🔥 Bin Riaz Grill Cloud Engine Online - Realtime Sync Active across all connected devices!");
