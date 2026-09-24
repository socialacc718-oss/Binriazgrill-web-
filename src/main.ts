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

window.deduplicateOrders = function(orders) {
    if (!Array.isArray(orders)) return [];
    const seenIds = new Set();
    const cleanList: any[] = [];
    const sorted = [...orders].sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));

    for (const ord of sorted) {
        if (!ord) continue;
        const ordId = String(ord.orderId || '');
        if (!ordId || seenIds.has(ordId)) continue;

        // Check if there is an exact duplicate clone (e.g. rapid double-tap within 5 seconds with identical items/slip)
        const isDuplicateClone = cleanList.some(existing => {
            if (existing.orderId && ord.orderId && String(existing.orderId) === String(ord.orderId)) return true;

            const timeA = Number(existing.timestamp) || 0;
            const timeB = Number(ord.timestamp) || 0;
            const timeDiff = (timeA > 0 && timeB > 0) ? Math.abs(timeA - timeB) : 0;

            const phoneA = String(existing.customerPhone || '').replace(/^0+/, '').replace(/[^0-9]/g, '');
            const phoneB = String(ord.customerPhone || '').replace(/^0+/, '').replace(/[^0-9]/g, '');
            const samePhone = phoneA && phoneB && (phoneA === phoneB);

            // Only treat as accidental clone if it's the exact same slip/items submitted within 5 seconds
            const sameSlip = existing.slipText && ord.slipText && existing.slipText.trim() === ord.slipText.trim();
            if (samePhone && sameSlip && timeDiff < 5000) return true;

            return false;
        });

        if (isDuplicateClone) {
            // It's an accidental rapid double-tap duplicate clone: remove it from Firebase RTDB
            try {
                if (window.firebaseDB && window.fbRemove && window.fbRef) {
                    window.fbRemove(window.fbRef(window.firebaseDB, 'binRiazGrill/orders/' + ordId)).catch(() => {});
                }
            } catch(e) {}
            continue;
        }

        seenIds.add(ordId);
        cleanList.push(ord);
    }
    return cleanList;
};

window.adminOrders = (function() {
    try {
        const raw = JSON.parse(localStorage.getItem('binRiazOrders') || '[]');
        return window.deduplicateOrders(raw);
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
  return items.map((item, idx) => {
    let img = item.image || null;
    if (typeof defaultMenuItems !== 'undefined' && Array.isArray(defaultMenuItems)) {
      const def = defaultMenuItems.find(d => d.id === item.id);
      if (def && def.image) {
        if (!img || img.includes('photo-1541592106381') || img.includes('photo-1550547660') || img.includes('photo-1627308595229') || img.includes('photo-1594041680534') || img.includes('photo-1567620832903')) {
          img = def.image;
        }
      }
    }
    return {
      id: String(item.id || ('dish-' + (Date.now() + idx))),
      name: String(item.name || 'Special Dish'),
      category: String(item.category || 'deals'),
      price: Number(item.price || 0),
      desc: String(item.desc || ''),
      tag: String(item.tag || ''),
      icon: String(item.icon || 'fa-utensils'),
      image: img
    };
  });
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
            // ⚡ Value & Dawat Deals
            { id: "deal-1", name: "DEAL-1 (Jumbo Roll Paratha Special)", category: "deals", price: 500, desc: "1 Jumbo Roll Paratha + 300ml Drink with Sauce", tag: "Bestseller", icon: "fa-burger", image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80" },
            { id: "deal-2", name: "DEAL-2 (Duo Roll Paratha)", category: "deals", price: 1000, desc: "2 Roll Paratha + 2 300ml Drink with Sauce", tag: "Popular", icon: "fa-utensils", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80" },
            { id: "deal-3", name: "DEAL-3 (Buy 5 Get 1 Free)", category: "deals", price: 2250, desc: "5 Roll Paratha with Sauce + Get 1 Free Roll Paratha", tag: "Value Deal", icon: "fa-gift", image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80" },
            { id: "deal-4", name: "DEAL-4 (Special 6+1 Offer)", category: "deals", price: 2500, desc: "6 Special Roll Paratha + Get 1 Roll Paratha Free", tag: "Family Deal", icon: "fa-users", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80" },
            { id: "deal-5", name: "DEAL-5 (Mega Feast 8+2 Offer)", category: "deals", price: 3500, desc: "8 Special Roll Paratha + Get 2 Roll Paratha Free", tag: "Mega Deal", icon: "fa-crown", image: "https://images.unsplash.com/photo-1561758033-d89a9ad46330?auto=format&fit=crop&w=600&q=80" },
            { id: "deal-desi-tarka", name: "DESI TARKA DEAL", category: "deals", price: 1200, desc: "Tawa Chicken + 2 Sauces + 3 Malwari Paratha + 1 Special Drink", tag: "Desi Special", icon: "fa-fire", image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80" },
            { id: "deal-dawat-4-5", name: "DAWAT DESI DEAL (4 to 5 Person)", category: "deals", price: 2600, desc: "Special Chicken Karahi (with extra Gravy) + Special Bonless Biryani (Matka) + 6 Roti / Naan + 2 Sauce + 1000ml Drink", tag: "Dawat Feast", icon: "fa-champagne-glasses", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80" },
            { id: "deal-dawat-6", name: "DAWAT DESI DEAL (6 Person)", category: "deals", price: 4800, desc: "Chicken Karahi With (Extra Gravy) + Special Biryani Full (Bonless Chicken) + 6 Naan + 2 Special Sauce with Drink", tag: "Grand Dawat", icon: "fa-champagne-glasses", image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80" },

            // 🍢 Bar BQ Platters
            { id: "platter-1", name: "BAR B Q PLATTER (1 Person)", category: "platters", price: 1300, desc: "Malai Boti / Chicken Boti / Behari Boti + Reshmi Kabab + Fried Rice / Malwari Paratha + Special Sauce (Imli Aloo Bukhara / White Sauce)", tag: "1 Person", icon: "fa-drumstick-bite", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80" },
            { id: "platter-2", name: "BAR B Q PLATTER (2 Persons)", category: "platters", price: 2000, desc: "Malai Boti / Chicken Boti / Behari Boti + Reshmi Kabab / Chicken Tikka (Leg / Chest) + Fried Rice / Naan / Malwari Paratha + Special Sauce", tag: "2 Persons", icon: "fa-drumstick-bite", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80" },
            { id: "platter-3", name: "BAR B Q PLATTER (3 Persons)", category: "platters", price: 2999, desc: "Malai Boti / Shangrila Boti / Chicken Boti / Behari Boti / Reshmi Kabab / Chicken Tikka (Leg / Chest) + Fried Rice / Naan / Malwari Paratha + Special Sauce", tag: "3 Persons", icon: "fa-drumstick-bite", image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80" },

            // 🌯 Roll Parathas
            { id: "roll-bin-riaz-jambo", name: "Bin Riaz Special Roll Paratha (Jambo)", category: "rolls", price: 550, desc: "Signature charcoal grilled chicken wrapped in fresh crisp Malwari Paratha (Jambo Size).", tag: "Signature", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-bin-riaz-regular", name: "Bin Riaz Special Roll Paratha (Regular)", category: "rolls", price: 450, desc: "Signature charcoal grilled chicken wrapped in fresh crisp Malwari Paratha (Regular Size).", tag: "Special", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-shangrilla-jambo", name: "Shangrilla Roll Paratha (Jambo)", category: "rolls", price: 450, desc: "Tender Shangrilla marinated chicken wrapped in crispy paratha (Jambo Size).", tag: "Jambo", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-shangrilla-reg", name: "Shangrilla Roll Paratha (Regular)", category: "rolls", price: 400, desc: "Tender Shangrilla marinated chicken wrapped in crispy paratha (Regular Size).", tag: "Regular", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-malai-jambo", name: "Malai Roll Paratha (Jambo)", category: "rolls", price: 450, desc: "Creamy tender Malai Boti rolled with fresh sauce in paratha (Jambo Size).", tag: "Mild", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-malai-reg", name: "Malai Roll Paratha (Regular)", category: "rolls", price: 400, desc: "Creamy tender Malai Boti rolled with fresh sauce in paratha (Regular Size).", tag: "Mild", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-chicken-jambo", name: "Chicken Roll Paratha (Jambo)", category: "rolls", price: 450, desc: "Classic seasoned charcoal chicken boti wrapped in crispy paratha (Jambo Size).", tag: "Classic", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-chicken-reg", name: "Chicken Roll Paratha (Regular)", category: "rolls", price: 400, desc: "Classic seasoned charcoal chicken boti wrapped in crispy paratha (Regular Size).", tag: "Classic", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-kabab-jambo", name: "Kabab Roll Paratha (Jambo)", category: "rolls", price: 450, desc: "Juicy minced chicken kabab wrapped with chutney and onions (Jambo Size).", tag: "Juicy", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-kabab-reg", name: "Kabab Roll Paratha (Regular)", category: "rolls", price: 400, desc: "Juicy minced chicken kabab wrapped with chutney and onions (Regular Size).", tag: "Juicy", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-cheese-jambo", name: "Chicken Cheese Roll Paratha (Jambo)", category: "rolls", price: 500, desc: "Chicken boti loaded with melted mozzarella cheese in paratha (Jambo Size).", tag: "Cheesy", icon: "fa-cheese", image: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-cheese-reg", name: "Chicken Cheese Roll Paratha (Regular)", category: "rolls", price: 450, desc: "Chicken boti loaded with melted mozzarella cheese in paratha (Regular Size).", tag: "Cheesy", icon: "fa-cheese", image: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-bihari-jambo", name: "Chicken Bihari Roll Paratha (Jambo)", category: "rolls", price: 450, desc: "Smoky Bihari spiced chicken wrapped in golden paratha (Jambo Size).", tag: "Smoky", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-bihari-reg", name: "Chicken Bihari Roll Paratha (Regular)", category: "rolls", price: 400, desc: "Smoky Bihari spiced chicken wrapped in golden paratha (Regular Size).", tag: "Smoky", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-green-jambo", name: "Green Boti Roll Paratha (Jambo)", category: "rolls", price: 500, desc: "Fresh mint and green herb chicken skewers in paratha (Jambo Size).", tag: "Spicy", icon: "fa-pepper-hot", image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-green-reg", name: "Green Boti Roll Paratha (Regular)", category: "rolls", price: 450, desc: "Fresh mint and green herb chicken skewers in paratha (Regular Size).", tag: "Spicy", icon: "fa-pepper-hot", image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-zinger-jambo", name: "Zinger Roll Paratha (Jambo)", category: "rolls", price: 500, desc: "Crispy crunchy zinger chicken fillet wrapped with sauce in paratha (Jambo Size).", tag: "Crunchy", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-zinger-reg", name: "Zinger Roll Paratha (Regular)", category: "rolls", price: 450, desc: "Crispy crunchy zinger chicken fillet wrapped with sauce in paratha (Regular Size).", tag: "Crunchy", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-chapati-jambo", name: "Chicken Chapati Roll (Jambo)", category: "rolls", price: 450, desc: "Light and healthy tandoori chapati wrapped with spiced chicken (Jambo Size).", tag: "Chapati", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-chapati-reg", name: "Chicken Chapati Roll (Regular)", category: "rolls", price: 400, desc: "Light and healthy tandoori chapati wrapped with spiced chicken (Regular Size).", tag: "Chapati", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-afghani-jambo", name: "Afghani Roll Paratha (Jambo)", category: "rolls", price: 450, desc: "Mild Afghani spiced tender chicken wrapped in paratha (Jambo Size).", tag: "Afghani", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-afghani-reg", name: "Afghani Roll Paratha (Regular)", category: "rolls", price: 400, desc: "Mild Afghani spiced tender chicken wrapped in paratha (Regular Size).", tag: "Afghani", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-bengali-jambo", name: "Bengali Roll Paratha (Jambo)", category: "rolls", price: 450, desc: "Zesty mustard & Bengali spice marinated chicken in paratha (Jambo Size).", tag: "Bengali", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-bengali-reg", name: "Bengali Roll Paratha (Regular)", category: "rolls", price: 400, desc: "Zesty mustard & Bengali spice marinated chicken in paratha (Regular Size).", tag: "Bengali", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-turkish-jambo", name: "Turkish Roll Paratha (Jambo)", category: "rolls", price: 500, desc: "Turkish herb infused tender chicken roll with special garlic sauce (Jambo Size).", tag: "Turkish", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-turkish-reg", name: "Turkish Roll Paratha (Regular)", category: "rolls", price: 450, desc: "Turkish herb infused tender chicken roll with special garlic sauce (Regular Size).", tag: "Turkish", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-hyderabadi-jambo", name: "Hyderabadi Roll Paratha (Jambo)", category: "rolls", price: 450, desc: "Spicy and tangy Hyderabadi charcoal chicken roll (Jambo Size).", tag: "Hyderabadi", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-hyderabadi-reg", name: "Hyderabadi Roll Paratha (Regular)", category: "rolls", price: 400, desc: "Spicy and tangy Hyderabadi charcoal chicken roll (Regular Size).", tag: "Hyderabadi", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-veg-jambo", name: "Vegetable Roll Paratha (Jambo)", category: "rolls", price: 400, desc: "Fresh seasoned garden vegetables and sauces in crispy paratha (Jambo Size).", tag: "Veg", icon: "fa-leaf", image: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-veg-reg", name: "Vegetable Roll Paratha (Regular)", category: "rolls", price: 350, desc: "Fresh seasoned garden vegetables and sauces in crispy paratha (Regular Size).", tag: "Veg", icon: "fa-leaf", image: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=600&q=80" },
            { id: "roll-cheese-paratha-special", name: "Chicken Cheese Paratha Special", category: "rolls", price: 800, desc: "Crisp golden paratha stuffed with spicy chicken and overflowing melted cheese.", tag: "House Special", icon: "fa-cheese", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80" },

            // 🔥 Charcoal BBQ & Tikka
            { id: "bbq-shangrila", name: "Shangrila Boti", category: "bbq", price: 1050, desc: "Prime boneless chicken marinated in Bin Riaz special Shangrila herbs.", tag: "Special", icon: "fa-fire-flame-curved", image: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=600&q=80" },
            { id: "bbq-malai", name: "Malai Boti", category: "bbq", price: 950, desc: "Melt-in-mouth boneless chicken boti grilled over natural charcoal.", tag: "Tender Mild", icon: "fa-fire-flame-curved", image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=600&q=80" },
            { id: "bbq-chicken-boti", name: "Chicken Boti", category: "bbq", price: 850, desc: "Juicy chicken skewers grilled with authentic spices.", tag: "Classic", icon: "fa-fire-flame-curved", image: "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80" },
            { id: "bbq-tika-boti", name: "Chicken Tika Boti", category: "bbq", price: 800, desc: "Spicy charcoal grilled chicken tikka boti.", tag: "Spicy", icon: "fa-fire-flame-curved", image: "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80" },
            { id: "bbq-bihari-boti", name: "Chicken Bihari Boti", category: "bbq", price: 900, desc: "Tender boneless chicken marinated in aromatic Bihari masala.", tag: "Bihari", icon: "fa-fire-flame-curved", image: "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80" },
            { id: "bbq-green", name: "Chicken Green Boti", category: "bbq", price: 900, desc: "Fresh mint and green chili infused chicken skewers.", tag: "Green Herbal", icon: "fa-pepper-hot", image: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=600&q=80" },
            { id: "bbq-namkeen", name: "Namkeen Boti", category: "bbq", price: 800, desc: "Traditional salt and pepper charcoal roasted chicken boti.", tag: "Namkeen", icon: "fa-drumstick-bite", image: "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80" },
            { id: "bbq-turkish-boti", name: "Turkish Boti", category: "bbq", price: 950, desc: "Exotic Turkish spiced succulent boneless chicken.", tag: "Turkish", icon: "fa-fire-flame-curved", image: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=600&q=80" },
            { id: "bbq-beef-behari", name: "Beef Bihari Boti", category: "bbq", price: 1050, desc: "Melt-in-mouth tender prime beef fillets in authentic Bihari masala.", tag: "Prime Beef", icon: "fa-fire-flame-curved", image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80" },
            { id: "bbq-drum-stick", name: "Drum Stick (Full Plate)", category: "bbq", price: 850, desc: "Full plate succulent grilled chicken drumsticks with dips.", tag: "Plate", icon: "fa-drumstick-bite", image: "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80" },
            { id: "tikka-chicken-leg", name: "Chicken Tikka (Leg)", category: "bbq", price: 400, desc: "Charcoal grilled juicy chicken leg quarter.", tag: "Leg", icon: "fa-drumstick-bite", image: "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80" },
            { id: "tikka-chicken-chest", name: "Chicken Tikka (Chest)", category: "bbq", price: 450, desc: "Charcoal grilled juicy chicken chest quarter.", tag: "Chest", icon: "fa-drumstick-bite", image: "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80" },
            { id: "tikka-chatkhara-leg", name: "Chatkhara Tikka (Leg)", category: "bbq", price: 400, desc: "Extra tangy and spicy chatkhara grilled chicken leg.", tag: "Chatkhara", icon: "fa-pepper-hot", image: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=600&q=80" },
            { id: "tikka-chatkhara-chest", name: "Chatkhara Tikka (Chest)", category: "bbq", price: 450, desc: "Extra tangy and spicy chatkhara grilled chicken breast.", tag: "Chatkhara", icon: "fa-pepper-hot", image: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=600&q=80" },
            { id: "tikka-malai-leg", name: "Malai Tikka (Leg)", category: "bbq", price: 450, desc: "Creamy mild marinated chicken leg quarter.", tag: "Malai", icon: "fa-drumstick-bite", image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=600&q=80" },
            { id: "tikka-malai-chest", name: "Malai Tikka (Chest)", category: "bbq", price: 500, desc: "Creamy mild marinated chicken chest quarter.", tag: "Malai", icon: "fa-drumstick-bite", image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=600&q=80" },
            { id: "tikka-green-leg", name: "Green Tikka (Leg)", category: "bbq", price: 450, desc: "Coriander & mint spicy marinated chicken leg.", tag: "Green Masala", icon: "fa-pepper-hot", image: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=600&q=80" },
            { id: "tikka-green-chest", name: "Green Tikka (Chest)", category: "bbq", price: 500, desc: "Coriander & mint spicy marinated chicken chest.", tag: "Green Masala", icon: "fa-pepper-hot", image: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=600&q=80" },
            { id: "tikka-namkeen-leg", name: "Namkeen Tikka (Leg)", category: "bbq", price: 400, desc: "Mild salt and pepper roast chicken leg quarter.", tag: "Namkeen", icon: "fa-drumstick-bite", image: "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80" },
            { id: "tikka-namkeen-chest", name: "Namkeen Tikka (Chest)", category: "bbq", price: 450, desc: "Mild salt and pepper roast chicken chest quarter.", tag: "Namkeen", icon: "fa-drumstick-bite", image: "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80" },
            { id: "tikka-wash-leg", name: "Wash Tikka (Leg)", category: "bbq", price: 400, desc: "Special lightly seasoned juicy chicken leg.", tag: "Wash Tikka", icon: "fa-drumstick-bite", image: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=600&q=80" },
            { id: "tikka-wash-chest", name: "Wash Tikka (Chest)", category: "bbq", price: 450, desc: "Special lightly seasoned juicy chicken chest.", tag: "Wash Tikka", icon: "fa-drumstick-bite", image: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=600&q=80" },

            // 🍢 Kabab Lovers
            { id: "bbq-reshmi", name: "Chicken Reshmi Kabab", category: "kabab", price: 900, desc: "Silky soft minced chicken skewers infused with saffron butter.", tag: "Reshmi", icon: "fa-fire-flame-curved", image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80" },
            { id: "kabab-chicken", name: "Chicken Kabab", category: "kabab", price: 850, desc: "Classic seasoned minced chicken charcoal grilled skewers.", tag: "Classic", icon: "fa-fire-flame-curved", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80" },
            { id: "kabab-gola-cheese", name: "Gola Cheese Kabab", category: "kabab", price: 1150, desc: "Melted molten cheese stuffed inside juicy spiced round gola kababs.", tag: "Cheese Stuffed", icon: "fa-cheese", image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80" },
            { id: "kabab-turkish", name: "Turkish Kabab", category: "kabab", price: 1050, desc: "Authentic Turkish style minced meat kabab roasted over embers.", tag: "Turkish", icon: "fa-fire-flame-curved", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80" },
            { id: "bbq-beef-seekh", name: "Beef Seekh Kabab", category: "kabab", price: 1150, desc: "Spiced prime minced beef skewers charcoal grilled to perfection.", tag: "Prime Beef", icon: "fa-fire-flame-curved", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80" },

            // 🍲 Desi Karahi
            { id: "karahi-chicken-half", name: "Chicken Karahi (Half)", category: "karahi", price: 1200, desc: "Prepared fresh in wok with tomatoes, ginger, green chilies & pure spices (Half).", tag: "Half", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80" },
            { id: "karahi-chicken-full", name: "Chicken Karahi (Full)", category: "karahi", price: 2200, desc: "Full wok serving of authentic desi chicken karahi with rich aromatic gravy (Full).", tag: "Full", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80" },
            { id: "karahi-makhni-half", name: "Makhni Karahi (Half)", category: "karahi", price: 1300, desc: "Velvety butter gravy prepared with tender chicken and mild herbs (Half).", tag: "Half", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=600&q=80" },
            { id: "karahi-makhni-full", name: "Makhni Karahi (Full)", category: "karahi", price: 2350, desc: "Velvety butter gravy prepared with tender chicken and mild herbs (Full).", tag: "Full", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=600&q=80" },
            { id: "karahi-white-half", name: "Chicken White Karahi (Half)", category: "karahi", price: 1350, desc: "Cream and yogurt base rich white sauce karahi with crushed white pepper (Half).", tag: "Half", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80" },
            { id: "karahi-white-full", name: "Chicken White Karahi (Full)", category: "karahi", price: 2350, desc: "Cream and yogurt base rich white sauce karahi with crushed white pepper (Full).", tag: "Full", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80" },
            { id: "karahi-namkeen-half", name: "Chicken Namkeen Karahi (Half)", category: "karahi", price: 1200, desc: "Traditional salt & pepper Peshawar style chicken karahi (Half).", tag: "Half", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80" },
            { id: "karahi-namkeen-full", name: "Chicken Namkeen Karahi (Full)", category: "karahi", price: 2200, desc: "Traditional salt & pepper Peshawar style chicken karahi (Full).", tag: "Full", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80" },
            { id: "karahi-shinwari-half", name: "Chicken Shinwari Karahi (Half)", category: "karahi", price: 1150, desc: "Authentic Shinwari recipe with fresh tomatoes and green chilies (Half).", tag: "Half", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80" },
            { id: "karahi-shinwari-full", name: "Chicken Shinwari Karahi (Full)", category: "karahi", price: 2000, desc: "Authentic Shinwari recipe with fresh tomatoes and green chilies (Full).", tag: "Full", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80" },
            { id: "karahi-green-half", name: "Green Karahi (Half)", category: "karahi", price: 1350, desc: "Fresh cilantro, mint and green chili aromatic wok gravy (Half).", tag: "Half", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80" },
            { id: "karahi-green-full", name: "Green Karahi (Full)", category: "karahi", price: 2200, desc: "Fresh cilantro, mint and green chili aromatic wok gravy (Full).", tag: "Full", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80" },
            { id: "karahi-kabab-half", name: "Kabab Karahi (Half)", category: "karahi", price: 1250, desc: "Succulent charcoal kababs simmered in spicy masala gravy (Half).", tag: "Half", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80" },
            { id: "karahi-kabab-full", name: "Kabab Karahi (Full)", category: "karahi", price: 2350, desc: "Succulent charcoal kababs simmered in spicy masala gravy (Full).", tag: "Full", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80" },
            { id: "karahi-mutton-half", name: "Mutton Karahi (Half)", category: "karahi", price: 2100, desc: "Fresh prime cuts of mutton cooked in traditional desi wok (Half).", tag: "Half", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1545247181-516773cae754?auto=format&fit=crop&w=600&q=80" },
            { id: "karahi-mutton-full", name: "Mutton Karahi (Full)", category: "karahi", price: 3800, desc: "Fresh prime cuts of mutton cooked in traditional desi wok (Full).", tag: "Full", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1545247181-516773cae754?auto=format&fit=crop&w=600&q=80" },

            // 🥣 Royal Handi
            { id: "handi-paneer-reshmi-half", name: "Paneer Rashmi Handi (Half)", category: "handi", price: 1500, desc: "Clay pot cooked boneless chicken & paneer chunks in royal silky gravy (Half).", tag: "Half", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=600&q=80" },
            { id: "handi-paneer-reshmi-full", name: "Paneer Rashmi Handi (Full)", category: "handi", price: 2500, desc: "Clay pot cooked boneless chicken & paneer chunks in royal silky gravy (Full).", tag: "Full", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=600&q=80" },
            { id: "handi-makhni-half", name: "Makhni Handi (Half)", category: "handi", price: 1400, desc: "Slow-cooked boneless chicken in buttery creamy tomato gravy (Half).", tag: "Half", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=600&q=80" },
            { id: "handi-makhni-full", name: "Makhni Handi (Full)", category: "handi", price: 2400, desc: "Slow-cooked boneless chicken in buttery creamy tomato gravy (Full).", tag: "Full", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=600&q=80" },
            { id: "handi-white-half", name: "White Handi (Half)", category: "handi", price: 1400, desc: "Traditional boneless white handi cooked with cream, yogurt & mild herbs (Half).", tag: "Half", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80" },
            { id: "handi-white-full", name: "White Handi (Full)", category: "handi", price: 2400, desc: "Traditional boneless white handi cooked with cream, yogurt & mild herbs (Full).", tag: "Full", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80" },
            { id: "handi-green-half", name: "Green Masala Handi (Half)", category: "handi", price: 1400, desc: "Boneless chicken prepared in fresh mint and green chili gravy (Half).", tag: "Half", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80" },
            { id: "handi-green-full", name: "Green Masala Handi (Full)", category: "handi", price: 2500, desc: "Boneless chicken prepared in fresh mint and green chili gravy (Full).", tag: "Full", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80" },
            { id: "handi-tikka-half", name: "Tika Handi (Half)", category: "handi", price: 1350, desc: "Charcoal tikka pieces simmered in rich clay handi gravy (Half).", tag: "Half", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80" },
            { id: "handi-tikka-full", name: "Tika Handi (Full)", category: "handi", price: 2350, desc: "Charcoal tikka pieces simmered in rich clay handi gravy (Full).", tag: "Full", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80" },
            { id: "handi-achari-half", name: "Achari Handi (Half)", category: "handi", price: 1400, desc: "Tangy pickled spiced boneless chicken in clay handi (Half).", tag: "Half", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80" },
            { id: "handi-achari-full", name: "Achari Handi (Full)", category: "handi", price: 2400, desc: "Tangy pickled spiced boneless chicken in clay handi (Full).", tag: "Full", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80" },
            { id: "handi-kabab-half", name: "Kabab Handi (Half)", category: "handi", price: 1400, desc: "Charcoal chicken kababs cooked in aromatic clay pot gravy (Half).", tag: "Half", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80" },
            { id: "handi-kabab-full", name: "Kabab Handi (Full)", category: "handi", price: 2350, desc: "Charcoal chicken kababs cooked in aromatic clay pot gravy (Full).", tag: "Full", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80" },
            { id: "handi-qeema-half", name: "Qeema Handi (Half)", category: "handi", price: 1400, desc: "Slow-simmered seasoned minced meat cooked in clay pot (Half).", tag: "Half", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80" },
            { id: "handi-qeema-full", name: "Qeema Handi (Full)", category: "handi", price: 2200, desc: "Slow-simmered seasoned minced meat cooked in clay pot (Full).", tag: "Full", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80" },
            { id: "handi-dal-makhni-half", name: "Dal Makhni Handi (Half)", category: "handi", price: 950, desc: "Creamy slow-simmered black lentils cooked with butter and cream (Half).", tag: "Half", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80" },
            { id: "handi-dal-makhni-full", name: "Dal Makhni Handi (Full)", category: "handi", price: 1650, desc: "Creamy slow-simmered black lentils cooked with butter and cream (Full).", tag: "Full", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80" },

            // 🍚 Matka Biryani Boneless
            { id: "biryani-special-half", name: "Bin Riaz Speacial Baryani (Half)", category: "biryani", price: 1350, desc: "Dum pukht fragrant basmati rice with boneless chicken in sealed clay pot (Half).", tag: "Special Half", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80" },
            { id: "biryani-special-full", name: "Bin Riaz Speacial Baryani (Full)", category: "biryani", price: 2200, desc: "Dum pukht fragrant basmati rice with boneless chicken in sealed clay pot (Full).", tag: "Special Full", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80" },
            { id: "biryani-chillman-half", name: "Chill Man Baryani (Half)", category: "biryani", price: 1200, desc: "Puff pastry covered aromatic boneless chicken dum biryani slow-baked (Half).", tag: "Chillman Half", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80" },
            { id: "biryani-chillman-full", name: "Chill Man Baryani (Full)", category: "biryani", price: 2000, desc: "Puff pastry covered aromatic boneless chicken dum biryani slow-baked (Full).", tag: "Chillman Full", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80" },
            { id: "biryani-nawabi-half", name: "Nawabi Baryani (Half)", category: "biryani", price: 1300, desc: "Richly spiced royal boneless biryani cooked with saffron and spices (Half).", tag: "Nawabi Half", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80" },
            { id: "biryani-nawabi-full", name: "Nawabi Baryani (Full)", category: "biryani", price: 2250, desc: "Richly spiced royal boneless biryani cooked with saffron and spices (Full).", tag: "Nawabi Full", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80" },
            { id: "biryani-sindhi-half", name: "Sindhi Baryani (Half)", category: "biryani", price: 1250, desc: "Spicy Sindh style biryani with aloo and tender boneless chicken (Half).", tag: "Sindhi Half", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80" },
            { id: "biryani-sindhi-full", name: "Sindhi Baryani (Full)", category: "biryani", price: 2100, desc: "Spicy Sindh style biryani with aloo and tender boneless chicken (Full).", tag: "Sindhi Full", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80" },
            { id: "biryani-hyd-half", name: "Hadrabadi Baryani (Half)", category: "biryani", price: 1250, desc: "Authentic Hyderabadi aromatic boneless kachi dum biryani (Half).", tag: "Hyderabadi Half", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80" },
            { id: "biryani-hyd-full", name: "Hadrabadi Baryani (Full)", category: "biryani", price: 2000, desc: "Authentic Hyderabadi aromatic boneless kachi dum biryani (Full).", tag: "Hyderabadi Full", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80" },

            // 🍟 Fries & Shawarma (Tikka Lovers / Fast Food)
            { id: "fastfood-fries-special", name: "Bin Riaz Speacial Fries", category: "fastfood", price: 500, desc: "Loaded crispy golden French fries topped with signature Bin Riaz toppings and cheese sauce.", tag: "House Special", icon: "fa-burger", image: "https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80" },
            { id: "fastfood-fries-masala", name: "Masala Fries", category: "fastfood", price: 400, desc: "Crispy golden potato fries tossed in chatpata spicy masala.", tag: "Spicy Masala", icon: "fa-burger", image: "https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80" },
            { id: "fastfood-fries-plain", name: "Plain Fries", category: "fastfood", price: 300, desc: "Crispy fried golden salted potato chips served hot.", tag: "Crispy", icon: "fa-burger", image: "https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80" },
            { id: "fastfood-shawarma-chicken", name: "Chicken Shawarma", category: "fastfood", price: 300, desc: "Tender shredded spiced chicken wrapped in pita with garlic sauce & pickles.", tag: "Classic", icon: "fa-bread-slice", image: "https://images.unsplash.com/photo-1561758033-d89a9ad46330?auto=format&fit=crop&w=600&q=80" },
            { id: "fastfood-shawarma-cheese", name: "Chicken Cheese Shawarma", category: "fastfood", price: 450, desc: "Loaded chicken shawarma bursting with melted premium mozzarella cheese.", tag: "Cheesy", icon: "fa-cheese", image: "https://images.unsplash.com/photo-1561758033-d89a9ad46330?auto=format&fit=crop&w=600&q=80" },
            { id: "fastfood-shawarma-veg", name: "Vegetable Shawarma", category: "fastfood", price: 200, desc: "Fresh crispy vegetables with creamy garlic sauce in warm pita bread.", tag: "Vegetarian", icon: "fa-leaf", image: "https://images.unsplash.com/photo-1561758033-d89a9ad46330?auto=format&fit=crop&w=600&q=80" },

            // 🫓 Tandoor
            { id: "tandoor-naan-roghni", name: "Roghni Naan", category: "tandoor", price: 80, desc: "Traditional sesame seed garnished butter-glazed tandoori naan.", tag: "Classic", icon: "fa-circle", image: "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=600&q=80" },
            { id: "tandoor-naan-plain", name: "Plain Naan", category: "tandoor", price: 40, desc: "Freshly baked clay oven plain tandoori naan.", tag: "Fresh", icon: "fa-circle", image: "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=600&q=80" },
            { id: "tandoor-roti", name: "Roti", category: "tandoor", price: 35, desc: "Traditional tandoori whole wheat roti.", tag: "Fresh Roti", icon: "fa-circle", image: "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=600&q=80" },
            { id: "tandoor-chapati", name: "Chapati", category: "tandoor", price: 35, desc: "Soft and light homemade tawa chapati.", tag: "Soft Chapati", icon: "fa-circle", image: "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=600&q=80" },
            { id: "tandoor-paratha-malwari", name: "Malwari Paratha", category: "tandoor", price: 80, desc: "Crispy, golden multi-layered Malwari style paratha.", tag: "Crispy", icon: "fa-circle", image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80" },

            // 🥗 Raita & Salad
            { id: "raita-green-salad", name: "Fresh Green Salad", category: "raita", price: 150, desc: "Freshly sliced cucumbers, tomatoes, onions, carrots & lemon.", tag: "Fresh", icon: "fa-leaf", image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80" },
            { id: "raita-mint", name: "Mint Raita", category: "raita", price: 150, desc: "Refreshing yogurt dip blended with fresh mint and green herbs.", tag: "Mint", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80" },
            { id: "raita-zeera", name: "Zeera Raita", category: "raita", price: 120, desc: "Cool curd tempered with roasted cumin seeds and spices.", tag: "Zeera", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80" },
            { id: "raita-imli-sauce", name: "Imli Sauce", category: "raita", price: 60, desc: "Bin Riaz signature sweet & sour tamarind chutney.", tag: "Sauce", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80" },
            { id: "raita-russian-salad", name: "Russian Salad", category: "raita", price: 250, desc: "Sweet and creamy diced potatoes, carrots, peas, apples & pineapple in mayo cream.", tag: "Sweet Salad", icon: "fa-bowl-food", image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80" },
            { id: "raita-fruit-salad", name: "Fruit Salad", category: "raita", price: 250, desc: "Fresh seasonal fruits served in rich cream.", tag: "Dessert Salad", icon: "fa-bowl-food", image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80" },
            { id: "raita-kheer-rasmalai", name: "Kheer / Ras Malai", category: "raita", price: 200, desc: "Traditional slow-cooked fragrant rice kheer or spongy ras malai in pistachio milk.", tag: "Sweet Dessert", icon: "fa-ice-cream", image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80" },

            // 🍲 Daig Selection (Live Catering & Daig)
            { id: "daig-chicken-biryani-10", name: "Chicken Biryani Daig (10x10)", category: "daig", price: 14000, desc: "Authentic live prepared full Daig (10kg Chicken & 10kg Super Basmati Rice) for grand occasions.", tag: "10x10 Daig", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80" },
            { id: "daig-chicken-biryani-8", name: "Chicken Biryani Daig (8x8)", category: "daig", price: 12000, desc: "Authentic live prepared medium Daig (8kg Chicken & 8kg Super Basmati Rice).", tag: "8x8 Daig", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80" },
            { id: "daig-chicken-pulao-10", name: "Chicken Pulao Daig (10x10)", category: "daig", price: 13500, desc: "Fragrant Yakhni Chicken Pulao Daig with super basmati rice and premium tender chicken.", tag: "10x10 Daig", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80" },
            { id: "daig-chicken-pulao-8", name: "Chicken Pulao Daig (8x8)", category: "daig", price: 11500, desc: "Fragrant Yakhni Chicken Pulao Daig (8kg Chicken & 8kg Rice).", tag: "8x8 Daig", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80" },
            { id: "daig-sindhi-biryani-8", name: "Sindhi Biryani Daig (8x8)", category: "daig", price: 12500, desc: "Traditional spicy Sindhi Biryani Daig with potatoes and juicy chicken.", tag: "8x8 Daig", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80" },
            { id: "daig-chillmaan-biryani-8", name: "Chillmaan Biryani Daig (8x8)", category: "daig", price: 13000, desc: "Chef's special Chillmaan style baked dum biryani daig with secret spice blend.", tag: "Special Daig", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80" },
            { id: "daig-beef-pulao-8", name: "Beef Pulao Daig (8x8)", category: "daig", price: 16000, desc: "Rich fragrant beef stock Yakhni pulao with prime tender beef cuts.", tag: "Beef Daig", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80" },
            { id: "daig-beef-biryani", name: "Beef Biryani Daig", category: "daig", price: 17000, desc: "Slow-cooked prime beef biryani daig with long grain aromatic basmati rice.", tag: "Beef Daig", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80" },
            { id: "daig-mutton-pulao", name: "Mutton Pulao Daig", category: "daig", price: 25000, desc: "Royal Kashmiri style mutton yakhni pulao made with fresh baby goat meat.", tag: "Mutton Daig", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80" },
            { id: "daig-mutton-biryani", name: "Mutton Biryani Daig", category: "daig", price: 26000, desc: "Grand royal mutton dum biryani daig prepared live with saffron & spices.", tag: "Grand Daig", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80" },
            { id: "daig-chana-pulao", name: "Chana Pulao Daig", category: "daig", price: 8500, desc: "Traditional aromatic basmati rice cooked with seasoned chickpeas.", tag: "Veg Daig", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80" },
            { id: "daig-veg-pulao", name: "Vegetable Pulao Daig", category: "daig", price: 8000, desc: "Fresh mixed farm vegetables cooked in fragrant basmati pulao.", tag: "Veg Daig", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80" },
            { id: "daig-achari-chana-pulao", name: "Achari Chana Pulao Daig", category: "daig", price: 9000, desc: "Tangy pickled spiced chana pulao daig with rich desi aroma.", tag: "Achari Daig", icon: "fa-bowl-rice", image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80" },
            { id: "daig-chicken-qorma", name: "Chicken Qorma Daig (8Kg to 14 Kg)", category: "daig", price: 15000, desc: "Rich Mughlai chicken qorma with thick fried onion and yogurt gravy.", tag: "Qorma Daig", icon: "fa-bowl-food", image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80" },
            { id: "daig-mutton-qorma", name: "Mutton Qorma Daig (8Kg to 14 Kg)", category: "daig", price: 28000, desc: "Authentic Shahi mutton degi qorma slow-simmered with crushed cardamom & kewra.", tag: "Mutton Qorma", icon: "fa-bowl-food", image: "https://images.unsplash.com/photo-1545247181-516773cae754?auto=format&fit=crop&w=600&q=80" },
            { id: "daig-beef-qorma", name: "Beef Qorma Daig (8Kg to 14 Kg)", category: "daig", price: 22000, desc: "Slow-cooked prime tender beef degi qorma with traditional rich gravy.", tag: "Beef Qorma", icon: "fa-bowl-food", image: "https://images.unsplash.com/photo-1545247181-516773cae754?auto=format&fit=crop&w=600&q=80" }
        ];

        const CURRENT_MENU_VERSION = 'v8_bin_riaz_official_card_menu_updated_2026';
        const storedVersion = localStorage.getItem('binRiazMenuVersion');
        let storedMenu = null;

        const ALL_REQUIRED_CATEGORIES = [
            'deals', 'platters', 'rolls', 'bbq', 'kabab', 'karahi', 'handi', 'biryani', 'fastfood', 'tandoor', 'raita', 'daig'
        ];

        function ensureAllCategoriesPopulated(items: any[]): any[] {
            if (!Array.isArray(items) || items.length === 0) {
                return [...defaultMenuItems];
            }
            // 1. Filter out obsolete categories
            let list = items.filter(item => item && ALL_REQUIRED_CATEGORIES.includes(item.category));
            let modified = false;

            // 2. Synchronize official default items: guarantee prices, names, and images strictly match the official menu card
            list = list.map(item => {
                const found = defaultMenuItems.find(d => d.id === item.id);
                if (found) {
                    if (item.price !== found.price || item.name !== found.name || item.desc !== found.desc || item.category !== found.category) {
                        modified = true;
                        return {
                            ...item,
                            name: found.name,
                            category: found.category,
                            price: found.price,
                            desc: found.desc,
                            tag: found.tag || item.tag,
                            image: found.image || item.image
                        };
                    }
                }
                return item;
            });

            // 3. Ensure all categories are populated
            for (const cat of ALL_REQUIRED_CATEGORIES) {
                const countInCat = list.filter(i => i && i.category === cat).length;
                if (countInCat === 0) {
                    const missingDefaults = defaultMenuItems.filter(d => d.category === cat);
                    list.push(...missingDefaults);
                    modified = true;
                }
            }

            // 4. Ensure all default items are present
            defaultMenuItems.forEach(defItem => {
                if (!list.some(i => i.id === defItem.id)) {
                    list.push(defItem);
                    modified = true;
                }
            });

            // 5. Ensure valid images
            list = list.map(item => {
                const found = defaultMenuItems.find(d => d.id === item.id);
                if (found && found.image) {
                    if (!item.image || item.image.includes('photo-1541592106381') || item.image.includes('photo-1550547660') || item.image.includes('photo-1627308595229') || item.image.includes('photo-1594041680534') || item.image.includes('photo-1567620832903')) {
                        item.image = found.image;
                        modified = true;
                    }
                }
                return item;
            });

            if (modified) {
                try {
                    localStorage.setItem('binRiazMenuData', JSON.stringify(list));
                    if (window.syncMenuOnline) {
                        window.syncMenuOnline(list);
                    }
                } catch(e) {}
            }

            return list;
        }

        if (storedVersion === CURRENT_MENU_VERSION) {
            try {
                const parsed = JSON.parse(localStorage.getItem('binRiazMenuData') || 'null');
                if (Array.isArray(parsed) && parsed.length > 0) {
                    storedMenu = parsed;
                }
            } catch(e) {}
        } else {
            // Version upgrade: replace cache with the updated menu
            localStorage.setItem('binRiazMenuVersion', CURRENT_MENU_VERSION);
            localStorage.removeItem('binRiazMenuData');
        }

        // Ensure every item has its authentic image from defaultMenuItems and all categories exist
        const initialMenu = ensureAllCategoriesPopulated(storedMenu || [...defaultMenuItems]);

        window.menuItems = initialMenu;
        try {
            localStorage.setItem('binRiazMenuData', JSON.stringify(window.menuItems));
        } catch(e) {}
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
            const shortName = user.username || (user.email ? user.email.split('@')[0] : "Member");
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

        window.calculateModifiers = function() {
            let drinkCost = 0;
            let drinkName = "";
            const drinkSelect = document.getElementById('checkoutDrinkSelect');
            const drinkFlavorSelect = document.getElementById('checkoutDrinkFlavor');
            const drinkFlavorBox = document.getElementById('drinkFlavorBox');
            const drinkPriceTag = document.getElementById('drinkPriceTag');

            if (drinkSelect && drinkSelect.value !== 'none') {
                const selectedOption = drinkSelect.options[drinkSelect.selectedIndex];
                drinkCost = parseInt(selectedOption.getAttribute('data-price') || '0', 10) || 0;
                const flavor = (drinkFlavorSelect && drinkFlavorSelect.value) ? drinkFlavorSelect.value : "Standard";
                drinkName = `${selectedOption.text.replace(/\(\+Rs\..*\)/, '').trim()} (${flavor})`;
                if (drinkFlavorBox) drinkFlavorBox.classList.remove('hidden');
                if (drinkPriceTag) drinkPriceTag.innerText = `+Rs. ${drinkCost}`;
            } else {
                if (drinkFlavorBox) drinkFlavorBox.classList.add('hidden');
                if (drinkPriceTag) drinkPriceTag.innerText = `Rs. 0`;
            }

            const extras = [];
            let extrasCost = 0;
            const modElements = [
                { id: 'modGravy', name: 'Extra Karahi Gravy & Ginger', price: 150 },
                { id: 'modSauces', name: 'Extra Sauces (Mint + Garlic Mayo)', price: 50 },
                { id: 'modRaita', name: 'Extra Fresh Salad & Mint Raita', price: 80 },
                { id: 'modParatha', name: 'Extra Crispy Malwari Paratha', price: 70 },
                { id: 'modNaan', name: 'Extra Butter Roghni Naan', price: 80 }
            ];

            modElements.forEach(m => {
                const el = document.getElementById(m.id);
                if (el && el.checked) {
                    extras.push(m.name);
                    extrasCost += m.price;
                }
            });

            const spiceEl = document.querySelector('input[name="spiceLevel"]:checked');
            const spiceLevel = spiceEl ? spiceEl.value : "Medium (Normal)";

            const totalModifiersCost = drinkCost + extrasCost;

            const badge = document.getElementById('modifiersCostBadge');
            if (badge) {
                badge.innerText = totalModifiersCost > 0 ? `+Rs. ${totalModifiersCost} Extras` : 'No Extras';
            }

            const modRow = document.getElementById('modifiersSubTotalRow');
            const modDisplay = document.getElementById('modifiersSubTotalDisplay');
            if (modRow && modDisplay) {
                if (totalModifiersCost > 0) {
                    modRow.classList.remove('hidden');
                    modDisplay.innerText = `+ Rs. ${totalModifiersCost}`;
                } else {
                    modRow.classList.add('hidden');
                }
            }

            return {
                drinkCost,
                drinkName,
                extras,
                extrasCost,
                spiceLevel,
                totalModifiersCost
            };
        };

        window.handleModifierChange = function() {
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

            const dishesSubTotal = window.cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
            const modifiersInfo = window.calculateModifiers ? window.calculateModifiers() : { totalModifiersCost: 0 };
            const modifiersCost = window.cart.length > 0 ? (modifiersInfo.totalModifiersCost || 0) : 0;
            const combinedSubTotal = dishesSubTotal + modifiersCost;

            subTotalDisplay.innerText = `Rs. ${dishesSubTotal}`;

            let finalPrice = combinedSubTotal;
            if (window.currentUser && window.memberDiscountPercent > 0 && dishesSubTotal > 0) {
                const discountAmt = Math.round((dishesSubTotal * window.memberDiscountPercent) / 100);
                finalPrice = Math.max(0, combinedSubTotal - discountAmt);
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
            if (window.isOrderSubmitting) {
                return;
            }

            const checkoutSubmitBtn = document.querySelector('button[onclick="sendOrderViaWhatsApp()"]') as HTMLButtonElement | null;
            if (checkoutSubmitBtn) {
                checkoutSubmitBtn.disabled = true;
                checkoutSubmitBtn.style.pointerEvents = 'none';
                checkoutSubmitBtn.classList.add('opacity-70');
            }

            if (window.cart.length === 0) {
                alert("Please add at least 1 item or deal to your order!");
                if (checkoutSubmitBtn) {
                    checkoutSubmitBtn.disabled = false;
                    checkoutSubmitBtn.style.pointerEvents = '';
                    checkoutSubmitBtn.classList.remove('opacity-70');
                }
                return;
            }

            const name = (document.getElementById('custName') as HTMLInputElement).value.trim();
            const phone = (document.getElementById('custPhone') as HTMLInputElement).value.trim();
            const address = (document.getElementById('custAddress') as HTMLTextAreaElement).value.trim();
            const notesEl = document.getElementById('custNotes') as HTMLTextAreaElement | null;
            const notes = notesEl ? notesEl.value.trim() : "";

            if (!name || !phone || !address) {
                alert("Please fill in your Name, Phone Number, and Delivery Address / Table Number.");
                if (checkoutSubmitBtn) {
                    checkoutSubmitBtn.disabled = false;
                    checkoutSubmitBtn.style.pointerEvents = '';
                    checkoutSubmitBtn.classList.remove('opacity-70');
                }
                return;
            }

            const modifiersInfo = window.calculateModifiers ? window.calculateModifiers() : {
                drinkCost: 0,
                drinkName: "",
                extras: [],
                extrasCost: 0,
                spiceLevel: "Medium (Normal)",
                totalModifiersCost: 0
            };

            const dishesSubTotal = window.cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
            const modifiersCost = modifiersInfo.totalModifiersCost || 0;
            const combinedSubTotal = dishesSubTotal + modifiersCost;

            let discountAmt = 0;
            if (window.currentUser && window.memberDiscountPercent > 0) {
                discountAmt = Math.round((dishesSubTotal * window.memberDiscountPercent) / 100);
            }
            const netTotal = Math.max(0, combinedSubTotal - discountAmt);

            // Anti-double-click guard: prevent submitting if an order submission is currently processing
            const now = Date.now();
            window.isOrderSubmitting = true;

            setTimeout(() => {
                window.isOrderSubmitting = false;
                if (checkoutSubmitBtn) {
                    checkoutSubmitBtn.disabled = false;
                    checkoutSubmitBtn.style.pointerEvents = '';
                    checkoutSubmitBtn.classList.remove('opacity-70');
                }
            }, 3000);

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

            slip += `\n*-------- 🛒 ORDER DISHES & DEALS --------*\n`;
            window.cart.forEach((item, index) => {
                slip += `${index + 1}. *${item.name}*\n`;
                slip += `    Qty: ${item.qty} x Rs. ${item.price} = *Rs. ${item.qty * item.price}*\n`;
            });

            // Modifiers & Add-ons
            if (modifiersInfo.drinkName || modifiersInfo.extras.length > 0 || modifiersInfo.spiceLevel) {
                slip += `\n*-------- 🥤 ADD-ONS & CUSTOMIZATION --------*\n`;
                if (modifiersInfo.drinkName) {
                    slip += `• *Cold Drink:* ${modifiersInfo.drinkName} (+Rs. ${modifiersInfo.drinkCost})\n`;
                }
                if (modifiersInfo.extras.length > 0) {
                    slip += `• *Extras / Sauces / Gravy:* ${modifiersInfo.extras.join(', ')} (+Rs. ${modifiersInfo.extrasCost})\n`;
                }
                slip += `• *Spice Level Preference:* ${modifiersInfo.spiceLevel}\n`;
            }

            if (notes) {
                slip += `\n*-------- 📝 SPECIAL INSTRUCTIONS --------*\n`;
                slip += `"${notes}"\n`;
            }
            
            slip += `\n*----------------------------------*\n`;
            slip += `*Dishes Subtotal:* Rs. ${dishesSubTotal}/-\n`;
            if (modifiersCost > 0) {
                slip += `*Add-ons & Extras:* +Rs. ${modifiersCost}/-\n`;
            }
            if (discountAmt > 0) {
                slip += `*Member Discount (${window.memberDiscountPercent}%):* -Rs. ${discountAmt}/-\n`;
            }
            slip += `*💰 TOTAL PAYABLE: Rs. ${netTotal}/-*\n`;
            slip += `*⚡ Delivery Guarantee:* 50 Minutes Rider Promise\n`;
            slip += `*----------------------------------*\n`;
            slip += `*📍 Kitchen Location:* Jinnah Center, Near Pakiza Cash & Carry, Jinnah Garden, Islamabad.\n`;
            slip += `_Please confirm my order as soon as possible! Thank you!_`;

            // Cloud Sync Order to Firebase RTDB with unique order ID
            const orderId = 'ORD-' + now + '-' + Math.floor(100 + Math.random() * 900);
            const orderRecord = {
                orderId: orderId,
                timestamp: now,
                date: dateNow,
                customerName: name,
                customerPhone: phone,
                deliveryAddress: address,
                memberEmail: window.currentUser ? window.currentUser.email : null,
                items: window.cart.map(function(i) { return { id: i.id, name: i.name, price: i.price, qty: i.qty }; }),
                notes: notes || null,
                drink: modifiersInfo.drinkName || null,
                extras: modifiersInfo.extras,
                spiceLevel: modifiersInfo.spiceLevel,
                modifiersTotal: modifiersCost,
                subTotal: dishesSubTotal,
                discountAmt: discountAmt,
                totalPayable: netTotal,
                slipText: slip,
                status: 'placed'
            };

            try {
                if (window.firebaseDB && window.fbRef && window.fbSet) {
                    window.fbSet(window.fbRef(window.firebaseDB, 'binRiazGrill/orders/' + orderId), orderRecord)
                        .catch(function(err) { console.warn('Order sync note:', err); });
                }
            } catch (e) {
                console.warn('Order sync error:', e);
            }

            // Add to local admin orders cache as well with deduplication
            if (!window.adminOrders) window.adminOrders = [];
            window.adminOrders.unshift(orderRecord);
            window.adminOrders = window.deduplicateOrders(window.adminOrders);
            try {
                localStorage.setItem('binRiazOrders', JSON.stringify(window.adminOrders));
            } catch(e) {}
            if (typeof window.renderAdminOrders === 'function') {
                window.renderAdminOrders();
            }

            startDeliveryCountdown();

            // Clear Cart & inputs
            window.cart = [];
            if (notesEl) notesEl.value = "";
            const drinkSelect = document.getElementById('checkoutDrinkSelect');
            if (drinkSelect) drinkSelect.value = "none";
            ['modGravy', 'modSauces', 'modRaita', 'modParatha', 'modNaan'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.checked = false;
            });
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
                const displayName = window.currentUser.username || window.currentUser.email;
                if (confirm(`Logged in as ${displayName}.\nDo you want to Sign Out?`)) {
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
            window.setAuthTab(isSignUpMode ? 'register' : 'login');
            document.getElementById('authModal').classList.toggle('hidden');
        };

        window.setAuthTab = function(mode: 'login' | 'register') {
            isSignUpMode = (mode === 'register');
            const userContainer = document.getElementById('authUsernameContainer');
            const tabLogin = document.getElementById('authTabLogin');
            const tabRegister = document.getElementById('authTabRegister');
            const title = document.getElementById('authModalTitle');
            const subtitle = document.getElementById('authModalSubtitle');
            const submitBtn = document.getElementById('authSubmitBtn');
            const switchBtn = document.getElementById('authSwitchBtn');

            if (userContainer) {
                userContainer.classList.toggle('hidden', !isSignUpMode);
            }

            if (isSignUpMode) {
                if (tabRegister) {
                    tabRegister.className = "flex-1 py-2 text-xs font-bold rounded-lg bg-amber-500 text-black transition shadow-sm";
                }
                if (tabLogin) {
                    tabLogin.className = "flex-1 py-2 text-xs font-semibold rounded-lg text-gray-400 hover:text-white transition";
                }
                if (title) title.innerText = "CREATE MEMBER ACCOUNT";
                if (subtitle) subtitle.innerText = "Register your Name & Email for exclusive member discounts!";
                if (submitBtn) submitBtn.innerHTML = `<span>Register & Create Account</span>`;
                if (switchBtn) switchBtn.innerText = "Already have an account? Sign In here";
                const usernameInput = document.getElementById('authUsername') as HTMLInputElement | null;
                if (usernameInput) setTimeout(() => usernameInput.focus(), 80);
            } else {
                if (tabLogin) {
                    tabLogin.className = "flex-1 py-2 text-xs font-bold rounded-lg bg-amber-500 text-black transition shadow-sm";
                }
                if (tabRegister) {
                    tabRegister.className = "flex-1 py-2 text-xs font-semibold rounded-lg text-gray-400 hover:text-white transition";
                }
                if (title) title.innerText = "MEMBER LOGIN";
                if (subtitle) subtitle.innerText = "Log in to unlock exclusive member discounts!";
                if (submitBtn) submitBtn.innerHTML = `<span>Sign In</span>`;
                if (switchBtn) switchBtn.innerText = "Don't have an account? Register new account";
            }
        };

        window.toggleAuthMode = function() {
            window.setAuthTab(isSignUpMode ? 'login' : 'register');
        };

        function triggerPasswordHeadShake(element: HTMLElement | null) {
            if (!element) return;
            element.classList.remove('password-head-shake', 'password-spin-exit');
            void element.offsetWidth; // re-trigger animation
            element.classList.add('password-head-shake');
            setTimeout(() => {
                element.classList.remove('password-head-shake');
            }, 700);
        }

        function triggerPasswordSpinExit(element: HTMLElement | null, onComplete: () => void) {
            if (!element) {
                onComplete();
                return;
            }
            element.classList.remove('password-head-shake', 'password-spin-exit');
            void element.offsetWidth;
            element.classList.add('password-spin-exit');
            setTimeout(() => {
                element.classList.remove('password-spin-exit');
                onComplete();
            }, 580);
        }

        // FIXED AUTHENTICATION SYSTEM:
        // 1. Users MUST register first with username, email & password.
        // 2. Unregistered users CANNOT log in (no fake auto-login fallback).
        // 3. Registered accounts are securely stored in persistent local database and Firebase Auth.
        window.handleAuthSubmit = function() {
            const emailInput = document.getElementById('authEmail') as HTMLInputElement | null;
            const passwordInput = document.getElementById('authPassword') as HTMLInputElement | null;
            const usernameInput = document.getElementById('authUsername') as HTMLInputElement | null;
            const email = emailInput ? emailInput.value.trim() : "";
            const password = passwordInput ? passwordInput.value.trim() : "";
            const username = usernameInput ? usernameInput.value.trim() : "";
            const submitBtn = document.getElementById('authSubmitBtn') as HTMLButtonElement | null;
            const authCard = document.getElementById('authModalCard');

            if (isSignUpMode && !username) {
                alert("Baraye meharbani apna Username / Name darj karein.");
                if (usernameInput) usernameInput.focus();
                return;
            }

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

            if (submitBtn) {
                submitBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> <span>Processing...</span>`;
                submitBtn.disabled = true;
            }

            const resetBtn = () => {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `<span>${isSignUpMode ? "Register Now" : "Sign In"}</span>`;
                }
            };

            // ================= MODE 1: REGISTRATION =================
            if (isSignUpMode) {
                if (userIndex !== -1) {
                    resetBtn();
                    alert("Yeh email pehle se registered hai! Baraye meharbani 'Sign In' karein.");
                    isSignUpMode = false;
                    const userContainer = document.getElementById('authUsernameContainer');
                    if (userContainer) userContainer.classList.add('hidden');
                    document.getElementById('authModalTitle').innerText = "MEMBER LOGIN";
                    if (submitBtn) submitBtn.innerHTML = `<span>Sign In</span>`;
                    document.getElementById('authSwitchBtn').innerText = "Don't have an account? Register";
                    return;
                }

                const userDisplayName = username || email.split('@')[0];

                // If Firebase Auth is available, create user there
                if (window.firebaseAuth && window.createUserWithEmailAndPassword) {
                    window.createUserWithEmailAndPassword(window.firebaseAuth, email, password)
                        .then((cred) => {
                            // Register in local database
                            currentRegisteredUsers.push({
                                username: userDisplayName,
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
                                        username: userDisplayName,
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
                            const userContainer = document.getElementById('authUsernameContainer');
                            if (userContainer) userContainer.classList.add('hidden');
                            document.getElementById('authModalTitle').innerText = "MEMBER LOGIN";
                            document.getElementById('authSwitchBtn').innerText = "Don't have an account? Register";
                            if (passwordInput) passwordInput.value = "";
                            if (usernameInput) usernameInput.value = "";
                            resetBtn();
                            alert(`Account kamyabi se register ho chuka hai, ${userDisplayName}! 🎉\nAb baraye meharbani Login karein.`);
                            window.showToast("Registration Successful! Please Sign In.", "success");
                        })
                        .catch((err) => {
                            if (err && err.code === 'auth/email-already-in-use') {
                                resetBtn();
                                alert("Yeh email pehle se registered hai! Baraye meharbani Sign In karein.");
                                isSignUpMode = false;
                                const userContainer = document.getElementById('authUsernameContainer');
                                if (userContainer) userContainer.classList.add('hidden');
                                document.getElementById('authModalTitle').innerText = "MEMBER LOGIN";
                                if (submitBtn) submitBtn.innerHTML = `<span>Sign In</span>`;
                                document.getElementById('authSwitchBtn').innerText = "Don't have an account? Register";
                                return;
                            }

                            // Fallback to local registration store if Firebase domain/network issue
                            currentRegisteredUsers.push({
                                username: userDisplayName,
                                email: email.toLowerCase(),
                                password: password,
                                uid: "local-" + Date.now(),
                                registeredAt: Date.now()
                            });
                            saveRegisteredUsers(currentRegisteredUsers);

                            isSignUpMode = false;
                            const userContainer = document.getElementById('authUsernameContainer');
                            if (userContainer) userContainer.classList.add('hidden');
                            document.getElementById('authModalTitle').innerText = "MEMBER LOGIN";
                            document.getElementById('authSwitchBtn').innerText = "Don't have an account? Register";
                            if (passwordInput) passwordInput.value = "";
                            if (usernameInput) usernameInput.value = "";
                            resetBtn();
                            alert(`Account kamyabi se register ho chuka hai, ${userDisplayName}! 🎉\nAb baraye meharbani Login karein.`);
                            window.showToast("Registration Successful! Please Sign In.", "success");
                        });
                } else {
                    // Local registration
                    currentRegisteredUsers.push({
                        username: userDisplayName,
                        email: email.toLowerCase(),
                        password: password,
                        uid: "local-" + Date.now(),
                        registeredAt: Date.now()
                    });
                    saveRegisteredUsers(currentRegisteredUsers);

                    isSignUpMode = false;
                    const userContainer = document.getElementById('authUsernameContainer');
                    if (userContainer) userContainer.classList.add('hidden');
                    document.getElementById('authModalTitle').innerText = "MEMBER LOGIN";
                    document.getElementById('authSwitchBtn').innerText = "Don't have an account? Register";
                    if (passwordInput) passwordInput.value = "";
                    if (usernameInput) usernameInput.value = "";
                    resetBtn();
                    alert(`Account kamyabi se register ho chuka hai, ${userDisplayName}! 🎉\nAb baraye meharbani Login karein.`);
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
                            const matchedUser = currentRegisteredUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
                            if (userIndex === -1) {
                                currentRegisteredUsers.push({
                                    username: matchedUser?.username || email.split('@')[0],
                                    email: email.toLowerCase(),
                                    password: password,
                                    uid: cred.user.uid,
                                    registeredAt: Date.now()
                                });
                                saveRegisteredUsers(currentRegisteredUsers);
                            }
                            window.setCurrentUserSession({ 
                                email: cred.user.email, 
                                username: matchedUser?.username || cred.user.displayName || email.split('@')[0],
                                uid: cred.user.uid 
                            }, true);
                            triggerPasswordSpinExit(authCard, () => {
                                document.getElementById('authModal')?.classList.add('hidden');
                                if (emailInput) emailInput.value = "";
                                if (passwordInput) passwordInput.value = "";
                            });
                        })
                        .catch((err) => {
                            // Check if account exists locally
                            if (userIndex !== -1) {
                                const localUser = currentRegisteredUsers[userIndex];
                                if (localUser.password === password) {
                                    resetBtn();
                                    window.setCurrentUserSession({ 
                                        email: localUser.email, 
                                        username: localUser.username || localUser.email.split('@')[0],
                                        uid: localUser.uid 
                                    }, true);
                                    triggerPasswordSpinExit(authCard, () => {
                                        document.getElementById('authModal')?.classList.add('hidden');
                                        if (emailInput) emailInput.value = "";
                                        if (passwordInput) passwordInput.value = "";
                                    });
                                    return;
                                } else {
                                    resetBtn();
                                    triggerPasswordHeadShake(authCard);
                                    alert("Galat Password! Baraye meharbani sahi password darj karein.");
                                    window.showToast("Incorrect password!", "error");
                                    return;
                                }
                            }

                            // If not in Firebase AND not in local database:
                            resetBtn();
                            triggerPasswordHeadShake(authCard);
                            alert("Aapka account register nahi hai!\nPehle 'Register' par click karke account banayein, phir login karein.");
                            window.showToast("Account not found! Please register first.", "error");
                        });
                } else {
                    // No Firebase - verify against local database
                    if (userIndex === -1) {
                        resetBtn();
                        triggerPasswordHeadShake(authCard);
                        alert("Aapka account register nahi hai!\nPehle 'Register' par click karke account banayein, phir login karein.");
                        window.showToast("Account not found! Please register first.", "error");
                        return;
                    }

                    const localUser = currentRegisteredUsers[userIndex];
                    if (localUser.password !== password) {
                        resetBtn();
                        triggerPasswordHeadShake(authCard);
                        alert("Galat Password! Baraye meharbani sahi password darj karein.");
                        window.showToast("Incorrect password!", "error");
                        return;
                    }

                    resetBtn();
                    window.setCurrentUserSession({ 
                        email: localUser.email, 
                        username: localUser.username || localUser.email.split('@')[0],
                        uid: localUser.uid 
                    }, true);
                    triggerPasswordSpinExit(authCard, () => {
                        document.getElementById('authModal')?.classList.add('hidden');
                        if (emailInput) emailInput.value = "";
                        if (passwordInput) passwordInput.value = "";
                    });
                }
            }
        };

        // ================= CUSTOMER REVIEWS CONTROLLER =================
        window.selectedReviewRating = 5;

        window.setReviewRating = function(rating: number) {
            window.selectedReviewRating = rating;
            const picker = document.getElementById('reviewStarPicker');
            if (!picker) return;
            const starSpans = picker.querySelectorAll('span');
            starSpans.forEach((span, index) => {
                const starVal = index + 1;
                if (starVal <= rating) {
                    span.className = "transition hover:scale-125 text-amber-400";
                    span.innerText = "★";
                } else {
                    span.className = "transition hover:scale-125 text-neutral-600";
                    span.innerText = "★";
                }
            });
        };

        window.openReviewModal = function() {
            const modal = document.getElementById('reviewModal');
            if (!modal) return;
            const authorInput = document.getElementById('reviewAuthorInput') as HTMLInputElement | null;
            if (authorInput) {
                if (window.currentUser) {
                    authorInput.value = window.currentUser.username || (window.currentUser.email ? window.currentUser.email.split('@')[0] : '');
                } else if (!authorInput.value) {
                    authorInput.value = '';
                }
            }
            window.setReviewRating(5);
            modal.classList.remove('hidden');
        };

        window.closeReviewModal = function() {
            const modal = document.getElementById('reviewModal');
            if (modal) modal.classList.add('hidden');
        };

        window.renderCustomerReviews = function() {
            const container = document.getElementById('userSubmittedReviewsContainer');
            if (!container) return;
            const reviews = window.customerReviews || [];
            if (reviews.length === 0) {
                container.innerHTML = '';
                return;
            }
            const colors = [
                'bg-amber-500/20 text-amber-400',
                'bg-red-500/20 text-red-400',
                'bg-blue-500/20 text-blue-400',
                'bg-emerald-500/20 text-emerald-400',
                'bg-purple-500/20 text-purple-400',
                'bg-cyan-500/20 text-cyan-400'
            ];
            container.innerHTML = reviews.map((rev: any, idx: number) => {
                const colorClass = colors[idx % colors.length];
                const stars = '★'.repeat(Math.max(1, Math.min(5, rev.rating || 5)));
                return `
                    <div class="glass-panel p-4 rounded-2xl border border-amber-500/30 flex flex-col justify-between shadow-lg bg-neutral-900/60 transition hover:border-amber-400/50">
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <div class="flex text-amber-400 text-xs">${stars}</div>
                                <span class="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase tracking-wider">New</span>
                            </div>
                            <p class="text-xs text-gray-200 leading-relaxed italic mb-3">"${escapeHtml(rev.text || '')}"</p>
                        </div>
                        <div class="flex items-center gap-2 pt-2 border-t border-white/5">
                            <div class="w-7 h-7 rounded-full ${colorClass} flex items-center justify-center font-bold text-xs shrink-0">${escapeHtml(rev.initials || 'CU')}</div>
                            <div class="overflow-hidden">
                                <h5 class="text-xs font-bold text-white leading-none truncate">${escapeHtml(rev.author || 'Guest')}</h5>
                                <span class="text-[10px] text-gray-500 truncate block">${escapeHtml(rev.location || 'Islamabad')}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        };

        window.submitCustomerReview = function() {
            const authorInput = document.getElementById('reviewAuthorInput') as HTMLInputElement | null;
            const locInput = document.getElementById('reviewLocationInput') as HTMLInputElement | null;
            const textInput = document.getElementById('reviewTextInput') as HTMLTextAreaElement | null;
            const submitBtn = document.getElementById('reviewSubmitBtn') as HTMLButtonElement | null;

            const author = authorInput ? authorInput.value.trim() : '';
            const location = locInput ? locInput.value.trim() : '';
            const text = textInput ? textInput.value.trim() : '';
            const rating = window.selectedReviewRating || 5;

            if (!author) {
                alert('Baraye meharbani apna Name ya Username darj karein!');
                if (authorInput) authorInput.focus();
                return;
            }
            if (!text) {
                alert('Baraye meharbani apna review ya comments darj karein!');
                if (textInput) textInput.focus();
                return;
            }

            if (submitBtn) {
                submitBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> <span>Submitting...</span>`;
                submitBtn.disabled = true;
            }

            const words = author.split(/\s+/).filter(Boolean);
            const initials = (words.length > 1 ? (words[0][0] + words[1][0]) : words[0].slice(0, 2)).toUpperCase();

            const newReview = {
                id: 'rev-' + Date.now(),
                author: author,
                initials: initials,
                location: location || 'Islamabad',
                rating: rating,
                text: text,
                timestamp: Date.now()
            };

            if (!window.customerReviews) window.customerReviews = [];
            window.customerReviews.unshift(newReview);

            try {
                localStorage.setItem('binRiazCustomerReviews', JSON.stringify(window.customerReviews));
            } catch(e) {}

            // Cloud sync to Firebase RTDB
            try {
                if (window.firebaseDB && window.fbRef && window.fbSet) {
                    window.fbSet(window.fbRef(window.firebaseDB, 'binRiazGrill/reviews/' + newReview.id), newReview)
                        .catch(() => {});
                }
            } catch(e) {}

            window.renderCustomerReviews();
            window.closeReviewModal();

            if (textInput) textInput.value = '';
            if (locInput) locInput.value = '';
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane text-xs"></i> <span>Submit Review</span>`;
            }

            window.showToast('Shukriya! Aapka review shamil kar diya gaya hai. ⭐', 'success');
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
            const pinInput = document.getElementById('adminPinInput') as HTMLInputElement | null;
            const entered = (pinInput?.value || '').trim();
            const storedPin = String(localStorage.getItem('binRiazAdminPin') || '').trim();
            const memoryPin = String(window.currentAdminPin || '').trim();
            const fallbackPin = "00123";
            const validPins = [memoryPin, storedPin, fallbackPin].filter(Boolean);

            const authCard = document.getElementById('adminAuthCard');

            if (entered && validPins.includes(entered)) {
                triggerPasswordSpinExit(authCard, () => {
                    window.closeAdminPrompt();
                    window.openAdminDashboard();
                    if (pinInput) pinInput.value = "";
                });
            } else {
                triggerPasswordHeadShake(authCard);
                window.showToast("Unauthorized! Incorrect Admin PIN ❌", "error");
                if (pinInput) {
                    pinInput.value = "";
                    pinInput.focus();
                }
            }
        };

        
// ================= ADMIN ORDERS RECORDS & SLIPS CONTROLLERS =================

window.renderAdminOrders = function() {
    const list = document.getElementById('adminOrdersList');
    const countEl = document.getElementById('adminOrdersCount');
    const revenueEl = document.getElementById('adminTotalRevenue');
    if (!list) return;

    if (typeof window.deduplicateOrders === 'function') {
        window.adminOrders = window.deduplicateOrders(window.adminOrders || []);
    }
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
    
    let textSlip = order.slipText;
    if (!textSlip || !textSlip.includes('SH COMPANY')) {
        const itemsList = (order.items || []).map(i => `• ${i.qty || 1}x ${i.name} - Rs. ${((Number(i.price) || 0) * (Number(i.qty) || 1)).toLocaleString()}`).join('\n');
        textSlip = 
`================================
      BIN RIAZ GRILL
   RESTAURANT & TANDOOR
 Authentic Charcoal & Desi Cuisine
 Jinnah Center, Pakiza Cash & Carry,
 Jinnah Garden, Islamabad
 Tel: 0332-5044423
================================
ORDER ID: ${order.orderId || 'ORD-NEW'}
DATE/TIME: ${order.date || new Date().toLocaleString()}
--------------------------------
CUSTOMER: ${order.customerName || 'Walk-in Customer'}
PHONE: ${order.customerPhone || 'N/A'}
ADDRESS: ${order.deliveryAddress || 'Dine-in / Takeaway'}
--------------------------------
ORDER ITEMS:
${itemsList || 'Special Order Items'}
--------------------------------
Subtotal: Rs. ${(Number(order.subTotal) || 0).toLocaleString()}
${Number(order.discountAmt) > 0 ? `Discount: -Rs. ${Number(order.discountAmt).toLocaleString()}\n` : ''}TOTAL PAYABLE: Rs. ${(Number(order.totalPayable) || 0).toLocaleString()}/-
================================
  *** THANK YOU FOR YOUR ORDER ***
--------------------------------
For Custom Websites, Apps & Software:
Contact / WhatsApp: +92 315 5496788
Developed by SH COMPANY
================================`;
    }

    window.currentViewingOrderSlip = textSlip;
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
                <td style="padding: 3px 0; vertical-align: top; font-weight: bold; width: 15%;">${itemQty}x</td>
                <td style="padding: 3px 4px; vertical-align: top; width: 55%;">${escapeHtml(item.name || 'Special Dish')}</td>
                <td style="padding: 3px 0; vertical-align: top; text-align: right; white-space: nowrap; width: 30%;">Rs. ${itemTotal.toLocaleString()}</td>
            </tr>
        `;
    }).join('');

    const subTotal = Number(order.subTotal || order.totalPayable || 0);
    const discountAmt = Number(order.discountAmt || 0);
    const totalPayable = Number(order.totalPayable || 0);

    return `
        <div class="thermal-pos-slip" style="width: 100%; max-width: 290px; margin: 0 auto; padding: 6px 8px; font-family: 'Courier New', Courier, monospace; color: #000; background: #fff; font-size: 11px; line-height: 1.35; letter-spacing: -0.2px;">
            <!-- 1. TOP RESTAURANT HEADER -->
            <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 6px;">
                <div style="font-size: 16px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">BIN RIAZ GRILL</div>
                <div style="font-size: 12px; font-weight: bold; margin-top: 1px;">RESTAURANT & TANDOOR</div>
                <div style="font-size: 10px; margin-top: 2px;">Authentic Charcoal & Desi Cuisine</div>
                <div style="font-size: 9.5px; margin-top: 1px;">Jinnah Center, Near Pakiza Cash & Carry, Islamabad</div>
                <div style="font-size: 11px; font-weight: bold; margin-top: 2px;">Tel / WhatsApp: 0332-5044423</div>
                <div style="font-size: 8.5px; margin-top: 3px; letter-spacing: 0.5px;">================================</div>
            </div>

            <!-- 2. MIDDLE ORDER DETAILS -->
            <div style="font-size: 11px; margin-bottom: 5px;">
                <div style="display: flex; justify-content: space-between;"><span style="font-weight: bold;">Order No:</span> <span style="font-weight: bold;">${escapeHtml(order.orderId || 'ORD-NEW')}</span></div>
                <div style="display: flex; justify-content: space-between;"><span>Date/Time:</span> <span>${escapeHtml(order.date || new Date().toLocaleString())}</span></div>
            </div>

            <div style="border-top: 1px dashed #000; padding-top: 4px; margin-bottom: 5px; font-size: 10.5px;">
                <div><span style="font-weight: bold;">Customer:</span> ${escapeHtml(order.customerName || 'Walk-in Customer')}</div>
                <div><span style="font-weight: bold;">Contact:</span> ${escapeHtml(order.customerPhone || 'N/A')}</div>
                <div><span style="font-weight: bold;">Address:</span> ${escapeHtml(order.deliveryAddress || 'Dine-in / Delivery')}</div>
                ${order.notes ? `<div style="margin-top: 2px;"><span style="font-weight: bold;">Notes:</span> <em>${escapeHtml(order.notes)}</em></div>` : ''}
                ${order.drink ? `<div style="margin-top: 2px;"><span style="font-weight: bold;">Drink:</span> ${escapeHtml(order.drink)}</div>` : ''}
                ${order.extras && order.extras.length > 0 ? `<div style="margin-top: 2px;"><span style="font-weight: bold;">Extras:</span> ${order.extras.map(e => typeof e === 'string' ? escapeHtml(e) : `${escapeHtml(e.name)} (+Rs. ${e.price})`).join(', ')}</div>` : ''}
                ${order.spiceLevel ? `<div style="margin-top: 2px;"><span style="font-weight: bold;">Spice:</span> ${escapeHtml(order.spiceLevel)}</div>` : ''}
            </div>

            <!-- ITEMS TABLE -->
            <div style="border-top: 1px dashed #000; padding-top: 4px; margin-bottom: 5px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead>
                        <tr style="border-bottom: 1px dashed #000; text-align: left;">
                            <th style="padding-bottom: 3px; width: 15%; font-weight: bold;">Qty</th>
                            <th style="padding-bottom: 3px; width: 55%; font-weight: bold;">Item</th>
                            <th style="padding-bottom: 3px; width: 30%; text-align: right; font-weight: bold;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows || '<tr><td colspan="3" style="padding: 4px 0;">Special Order Items</td></tr>'}
                    </tbody>
                </table>
            </div>

            <!-- TOTALS -->
            <div style="border-top: 1px dashed #000; padding-top: 5px; margin-bottom: 5px; font-size: 11px;">
                <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span> <span>Rs. ${subTotal.toLocaleString()}</span></div>
                ${discountAmt > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Discount:</span> <span>-Rs. ${discountAmt.toLocaleString()}</span></div>` : ''}
                <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 900; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; margin-top: 4px;">
                    <span>TOTAL PAYABLE:</span>
                    <span>Rs. ${totalPayable.toLocaleString()}/-</span>
                </div>
            </div>

            <!-- ORDER COMPLETE MESSAGE -->
            <div style="text-align: center; border-top: 1px dashed #000; padding-top: 5px; font-size: 10px; line-height: 1.35;">
                <div style="font-weight: bold;">⚡ 50 Minutes Delivery Promise ⚡</div>
                <div style="margin-top: 2px; font-weight: bold;">*** THANK YOU FOR YOUR ORDER ***</div>
                <div style="font-size: 9px;">Freshly Prepared • Hot & Delicious</div>
            </div>

            <!-- 3. END BOTTOM PROMOTION -->
            <div style="text-align: center; border-top: 1px dashed #000; padding-top: 6px; margin-top: 6px; font-size: 9.5px; line-height: 1.35;">
                <div style="font-size: 8.5px; letter-spacing: 0.5px;">================================</div>
                <div style="font-weight: bold; margin-top: 2px;">For Custom Websites, Apps & POS Software:</div>
                <div style="font-size: 11px; font-weight: 900; letter-spacing: 0.5px; margin: 2px 0;">📞 +92 315 5496788</div>
                <div style="font-weight: bold; text-transform: uppercase; font-size: 10px; border-top: 1px dotted #000; padding-top: 2px; margin-top: 3px;">
                    DEVELOPED BY SH COMPANY
                </div>
                <div style="font-size: 8.5px; letter-spacing: 0.5px; margin-top: 2px;">================================</div>
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

    const deleteCard = document.getElementById('deleteOrderAuthCard');

    if (!entered || !validPins.includes(entered)) {
        triggerPasswordHeadShake(deleteCard);
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

    triggerPasswordSpinExit(deleteCard, () => {
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
    });
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
                triggerPasswordHeadShake(currentPassEl as HTMLElement | null);
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

        function processSelectedImage(
            file: File,
            onSuccess: (dataUrl: string) => void,
            onStatus: (text: string, isSuccess: boolean) => void
        ) {
            if (!file) return;
            onStatus("Processing selected photo...", false);

            const reader = new FileReader();
            reader.onerror = function() {
                onStatus("Could not read photo file", false);
                window.showToast("Failed to read image file ❌", "error");
            };

            reader.onload = function(e) {
                const rawDataUrl = e.target?.result as string;
                if (!rawDataUrl) {
                    onStatus("Could not read photo data", false);
                    return;
                }

                // 1. Instantly provide image data so preview & submit work immediately
                onSuccess(rawDataUrl);
                const displayName = file.name ? (file.name.length > 22 ? file.name.slice(0, 19) + '...' : file.name) : "Photo ready";
                onStatus(displayName + " ✓", true);

                // 2. Compress image in background to keep Firebase and LocalStorage ultra fast (<180KB)
                try {
                    const img = new Image();
                    img.onload = function() {
                        try {
                            const canvas = document.createElement('canvas');
                            let width = img.width;
                            let height = img.height;
                            const maxDim = 600;

                            if (width > 0 && height > 0) {
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
                                if (ctx) {
                                    ctx.drawImage(img, 0, 0, width, height);
                                    const compressed = canvas.toDataURL('image/jpeg', 0.8);
                                    if (compressed && compressed.length > 50) {
                                        onSuccess(compressed);
                                    }
                                }
                            }
                        } catch(canvasErr) {
                            console.warn("Canvas compression note, using raw image:", canvasErr);
                        }
                    };
                    img.src = rawDataUrl;
                } catch(imgErr) {
                    console.warn("Image load note:", imgErr);
                }
            };

            reader.readAsDataURL(file);
        }

        window.triggerFileInput = function(inputId: string) {
            const inputEl = document.getElementById(inputId) as HTMLInputElement | null;
            if (inputEl) {
                inputEl.value = '';
                inputEl.click();
            }
        };

        window.handleImageFile = function(input: HTMLInputElement) {
            if (input && input.files && input.files[0]) {
                processSelectedImage(
                    input.files[0],
                    function(dataUrl) {
                        window.uploadedImageBase64 = dataUrl;
                        const previewImg = document.getElementById('imagePreviewImg') as HTMLImageElement | null;
                        const previewContainer = document.getElementById('imagePreviewContainer');
                        if (previewImg) previewImg.src = dataUrl;
                        if (previewContainer) previewContainer.classList.remove('hidden');
                    },
                    function(text, isSuccess) {
                        const selectedText = document.getElementById('imageSelectedText');
                        if (selectedText) {
                            selectedText.innerText = text;
                            selectedText.className = isSuccess ? "text-xs text-green-400 font-semibold" : "text-xs text-amber-400 font-semibold";
                        }
                    }
                );
            }
        };

        // ================= EDIT MENU ITEM HANDLERS =================
        window.editUploadedImageBase64 = "";

        window.openEditMenuItemModal = function(id) {
            const item = (window.menuItems || []).find(i => String(i.id) === String(id));
            if (!item) {
                window.showToast("Dish not found!", "error");
                return;
            }

            const idInput = document.getElementById('editItemId') as HTMLInputElement | null;
            const nameInput = document.getElementById('editFoodName') as HTMLInputElement | null;
            const catSelect = document.getElementById('editFoodCategory') as HTMLSelectElement | null;
            const priceInput = document.getElementById('editFoodPrice') as HTMLInputElement | null;
            const tagInput = document.getElementById('editFoodTag') as HTMLInputElement | null;
            const descInput = document.getElementById('editFoodDesc') as HTMLTextAreaElement | null;
            const previewImg = document.getElementById('editImagePreviewImg') as HTMLImageElement | null;
            const selectedText = document.getElementById('editImageSelectedText');

            if (idInput) idInput.value = item.id;
            if (nameInput) nameInput.value = item.name || '';
            if (catSelect) catSelect.value = item.category || 'deals';
            if (priceInput) priceInput.value = String(item.price || 0);
            if (tagInput) tagInput.value = item.tag || '';
            if (descInput) descInput.value = item.desc || '';
            if (previewImg) previewImg.src = item.image || '';
            if (selectedText) {
                selectedText.innerText = item.image ? "Active menu picture loaded" : "No picture set";
                selectedText.className = "text-xs text-gray-400 italic";
            }
            window.editUploadedImageBase64 = item.image || "";

            const modal = document.getElementById('editItemModal');
            if (modal) modal.classList.remove('hidden');
        };

        window.closeEditMenuItemModal = function() {
            const modal = document.getElementById('editItemModal');
            if (modal) modal.classList.add('hidden');
            window.editUploadedImageBase64 = "";
        };

        window.handleEditImageFile = function(input: HTMLInputElement) {
            if (input && input.files && input.files[0]) {
                processSelectedImage(
                    input.files[0],
                    function(dataUrl) {
                        window.editUploadedImageBase64 = dataUrl;
                        const previewImg = document.getElementById('editImagePreviewImg') as HTMLImageElement | null;
                        if (previewImg) previewImg.src = dataUrl;
                    },
                    function(text, isSuccess) {
                        const selectedText = document.getElementById('editImageSelectedText');
                        if (selectedText) {
                            selectedText.innerText = text;
                            selectedText.className = isSuccess ? "text-xs text-green-400 font-semibold" : "text-xs text-amber-400 font-semibold";
                        }
                    }
                );
            }
        };

        window.saveEditedMenuItem = function() {
            const id = (document.getElementById('editItemId') as HTMLInputElement)?.value;
            const name = (document.getElementById('editFoodName') as HTMLInputElement)?.value.trim();
            const price = parseInt((document.getElementById('editFoodPrice') as HTMLInputElement)?.value, 10);
            const category = (document.getElementById('editFoodCategory') as HTMLSelectElement)?.value;
            const tag = (document.getElementById('editFoodTag') as HTMLInputElement)?.value.trim() || "";
            const desc = (document.getElementById('editFoodDesc') as HTMLTextAreaElement)?.value.trim() || "";

            if (!name) {
                alert("Please enter a valid dish name!");
                return;
            }
            if (!price || isNaN(price) || price <= 0) {
                alert("Please enter a valid price!");
                return;
            }

            const itemIndex = (window.menuItems || []).findIndex(i => String(i.id) === String(id));
            if (itemIndex === -1) {
                alert("Dish not found!");
                return;
            }

            const saveBtn = document.getElementById('saveEditItemBtn');
            if (saveBtn) {
                saveBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> <span>Saving...</span>`;
            }

            window.menuItems[itemIndex].name = name;
            window.menuItems[itemIndex].price = price;
            window.menuItems[itemIndex].category = category;
            window.menuItems[itemIndex].tag = tag;
            window.menuItems[itemIndex].desc = desc;
            if (window.editUploadedImageBase64) {
                window.menuItems[itemIndex].image = window.editUploadedImageBase64;
            }

            try {
                localStorage.setItem('binRiazMenuData', JSON.stringify(window.menuItems));
            } catch(e) {}

            if (typeof window.syncMenuOnline === 'function') {
                window.syncMenuOnline(window.menuItems);
            } else if (window.firebaseDB && window.fbSet && window.fbRef) {
                window.fbSet(window.fbRef(window.firebaseDB, 'binRiazGrill/menu'), window.menuItems);
            }

            if (saveBtn) {
                saveBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> <span>Save Changes</span>`;
            }

            window.closeEditMenuItemModal();
            window.renderFilteredMenu();
            window.refreshAdminItemsList();
            window.showToast(`"${name}" updated successfully! 🎉`);
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

        window.adminMenuSearchQuery = "";
        window.adminMenuSelectedCategory = "all";

        window.openFullMenuManagerModal = function() {
            const modal = document.getElementById('adminFullMenuModal');
            if (modal) modal.classList.remove('hidden');
            window.adminMenuSearchQuery = "";
            const searchInput = document.getElementById('adminMenuSearchInput') as HTMLInputElement | null;
            if (searchInput) {
                searchInput.value = "";
                setTimeout(() => searchInput.focus(), 100);
            }
            const clearBtn = document.getElementById('adminMenuSearchClearBtn');
            if (clearBtn) clearBtn.classList.add('hidden');
            window.setAdminCategoryFilter('all');
            window.renderAdminFullMenuList();
        };

        window.closeFullMenuManagerModal = function() {
            const modal = document.getElementById('adminFullMenuModal');
            if (modal) modal.classList.add('hidden');
        };

        window.handleAdminMenuSearch = function(query: string) {
            window.adminMenuSearchQuery = (query || '').toLowerCase().trim();
            const clearBtn = document.getElementById('adminMenuSearchClearBtn');
            if (clearBtn) {
                if (window.adminMenuSearchQuery) {
                    clearBtn.classList.remove('hidden');
                } else {
                    clearBtn.classList.add('hidden');
                }
            }
            window.renderAdminFullMenuList();
        };

        window.clearAdminMenuSearch = function() {
            const searchInput = document.getElementById('adminMenuSearchInput') as HTMLInputElement | null;
            if (searchInput) {
                searchInput.value = "";
                searchInput.focus();
            }
            window.handleAdminMenuSearch("");
        };

        window.setAdminCategoryFilter = function(category: string) {
            window.adminMenuSelectedCategory = category || 'all';
            const pills = document.querySelectorAll('.admin-cat-pill');
            pills.forEach(pill => {
                const cat = pill.getAttribute('data-cat');
                if (cat === window.adminMenuSelectedCategory) {
                    pill.className = "admin-cat-pill active-cat-pill px-3 py-1 rounded-lg bg-amber-500 text-black font-bold whitespace-nowrap cursor-pointer transition shadow-md shadow-amber-500/20";
                } else {
                    pill.className = "admin-cat-pill px-3 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-gray-300 border border-white/10 whitespace-nowrap cursor-pointer transition";
                }
            });
            window.renderAdminFullMenuList();
        };

        window.renderAdminFullMenuList = function() {
            const container = document.getElementById('adminFullMenuItemsList');
            const totalBadge = document.getElementById('adminFullMenuTotalBadge');
            const statusText = document.getElementById('adminMenuFilterStatusText');
            const mainCountBadge = document.getElementById('adminTotalItemsCount');
            const menuBtnCount = document.getElementById('adminMenuBtnCount');

            const allItems = window.menuItems || [];
            if (mainCountBadge) mainCountBadge.innerText = `${allItems.length} Dishes`;
            if (menuBtnCount) menuBtnCount.innerText = `${allItems.length} Dishes`;

            if (!container) return;

            const q = window.adminMenuSearchQuery || '';
            const selectedCat = window.adminMenuSelectedCategory || 'all';

            const filtered = allItems.filter(item => {
                if (selectedCat !== 'all' && item.category !== selectedCat) {
                    return false;
                }
                if (q) {
                    const matchName = item.name && item.name.toLowerCase().includes(q);
                    const matchCat = item.category && item.category.toLowerCase().includes(q);
                    const matchPrice = String(item.price).includes(q);
                    const matchTag = item.tag && item.tag.toLowerCase().includes(q);
                    const matchDesc = item.desc && item.desc.toLowerCase().includes(q);
                    return matchName || matchCat || matchPrice || matchTag || matchDesc;
                }
                return true;
            });

            if (totalBadge) {
                totalBadge.innerText = `${filtered.length} of ${allItems.length} Dishes`;
            }

            if (statusText) {
                if (q && selectedCat !== 'all') {
                    statusText.innerText = `Search "${q}" in ${selectedCat.toUpperCase()} (${filtered.length} found)`;
                } else if (q) {
                    statusText.innerText = `Search results for "${q}" (${filtered.length} found)`;
                } else if (selectedCat !== 'all') {
                    statusText.innerText = `Filtered by category: ${selectedCat.toUpperCase()} (${filtered.length} dishes)`;
                } else {
                    statusText.innerText = `Showing all ${allItems.length} menu dishes`;
                }
            }

            if (filtered.length === 0) {
                container.innerHTML = `
                    <div class="py-16 text-center text-gray-500 flex flex-col items-center justify-center">
                        <div class="w-14 h-14 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center text-amber-400 text-xl mb-3">
                            <i class="fa-solid fa-magnifying-glass"></i>
                        </div>
                        <h4 class="text-sm font-bold text-white mb-1">No Matching Dishes Found</h4>
                        <p class="text-xs text-gray-400 max-w-xs mb-4">"${q || selectedCat}" se koi dish match nahi hui. Baraye meharbani search ya category badal kar try karein.</p>
                        <button type="button" onclick="window.clearAdminMenuSearch(); window.setAdminCategoryFilter('all');" class="bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/30 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer">
                            Reset Search & Show All
                        </button>
                    </div>
                `;
                return;
            }

            container.innerHTML = "";

            filtered.forEach(item => {
                const card = document.createElement('div');
                card.className = "p-3 bg-neutral-950/70 hover:bg-neutral-900/80 border border-white/5 hover:border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition group";
                
                const categoryLabel = (item.category || '').toUpperCase().replace('_', ' ');
                const tagBadge = item.tag ? `<span class="inline-block bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] px-1.5 py-0.5 rounded-md font-semibold">${item.tag}</span>` : '';

                card.innerHTML = `
                    <div class="flex items-center gap-3 min-w-0 flex-1">
                        ${item.image 
                            ? `<img src="${item.image}" alt="${item.name}" class="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border border-white/10 shrink-0 shadow-md">` 
                            : `<div class="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-neutral-900 border border-white/10 flex items-center justify-center text-amber-400 text-base shrink-0"><i class="fa-solid ${item.icon || 'fa-utensils'}"></i></div>`
                        }
                        <div class="min-w-0 flex-1 space-y-0.5">
                            <div class="flex items-center gap-2 flex-wrap">
                                <h5 class="text-xs sm:text-sm font-bold text-white group-hover:text-amber-300 transition truncate">${item.name}</h5>
                                ${tagBadge}
                            </div>
                            <div class="flex items-center gap-2 text-[11px] text-gray-400">
                                <span class="bg-white/5 px-2 py-0.5 rounded text-[10px] text-gray-300 font-mono">${categoryLabel}</span>
                                <span class="text-amber-400 font-mono font-bold">Rs. ${item.price}</span>
                            </div>
                            ${item.desc ? `<p class="text-[11px] text-gray-400 line-clamp-1">${item.desc}</p>` : ''}
                        </div>
                    </div>
                    <div class="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button type="button" onclick="window.openEditMenuItemModal('${item.id}')" class="bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/30 px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 active:scale-95 cursor-pointer flex items-center gap-1.5">
                            <i class="fa-solid fa-pen-to-square text-[11px]"></i>
                            <span>Edit</span>
                        </button>
                        <button type="button" onclick="window.deleteMenuItem('${item.id}')" class="bg-red-600/15 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 active:scale-95 cursor-pointer flex items-center gap-1.5">
                            <i class="fa-solid fa-trash-can text-[11px]"></i>
                            <span>Del</span>
                        </button>
                    </div>
                `;
                container.appendChild(card);
            });
        };

        window.refreshAdminItemsList = function() {
            const countBadge = document.getElementById('adminTotalItemsCount');
            const btnCountBadge = document.getElementById('adminMenuBtnCount');
            const listContainer = document.getElementById('adminItemsList');
            if (countBadge) countBadge.innerText = `${(window.menuItems || []).length} Dishes`;
            if (btnCountBadge) btnCountBadge.innerText = `${(window.menuItems || []).length} Dishes`;
            if (listContainer) listContainer.innerHTML = "";
            if (typeof window.renderAdminFullMenuList === 'function') {
                window.renderAdminFullMenuList();
            }
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
        window.menuItems = ensureAllCategoriesPopulated(sanitizeMenuItems(items));
        try {
          localStorage.setItem('binRiazMenuData', JSON.stringify(window.menuItems));
        } catch (e) {}
        if (typeof window.renderFilteredMenu === 'function') window.renderFilteredMenu();
        if (typeof window.refreshAdminItemsList === 'function') window.refreshAdminItemsList();

        // If cloud items were missing images, had outdated prices, or had old categories, write back the full sanitized items
        const isOutdated = items.some(i => !i.image || i.category === 'chinese' || (i.id === 'deal-3' && i.price !== 2250) || (i.id === 'deal-4' && i.price !== 2500) || (i.id === 'deal-5' && i.price !== 3500)) || window.menuItems.length !== items.length;
        if (isOutdated) {
          set(menuRef, window.menuItems).catch(() => {});
          try {
            setDoc(doc(firestore, 'binRiazGrill', 'menuData'), { items: window.menuItems, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
          } catch(e) {}
        }
      }
    } else {
      // RTDB menu node is empty: check Firestore first before seeding defaults
      getDoc(doc(firestore, 'binRiazGrill', 'menuData')).then((snap) => {
        if (snap.exists() && snap.data()?.items?.length > 0) {
          const firestoreItems = snap.data().items;
          window.menuItems = ensureAllCategoriesPopulated(sanitizeMenuItems(firestoreItems));
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
          window.menuItems = ensureAllCategoriesPopulated(sanitizeMenuItems(data.items));
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
      if (typeof window.deduplicateOrders === 'function') {
        ordersArr = window.deduplicateOrders(ordersArr);
      } else {
        ordersArr.sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
      }
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

// 7. Realtime Customer Reviews Listener
try {
  const reviewsRef = ref(db, 'binRiazGrill/reviews');
  onValue(reviewsRef, (snapshot) => {
    if (snapshot.exists()) {
      const val = snapshot.val();
      let revsArr: any[] = [];
      if (Array.isArray(val)) {
        revsArr = val.filter(Boolean);
      } else if (val && typeof val === 'object') {
        revsArr = Object.values(val);
      }
      revsArr.sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
      window.customerReviews = revsArr;
      try {
        localStorage.setItem('binRiazCustomerReviews', JSON.stringify(revsArr));
      } catch (e) {}
      if (typeof window.renderCustomerReviews === 'function') {
        window.renderCustomerReviews();
      }
    }
  }, (err) => {
    console.warn('Reviews listener note:', err);
  });
} catch (e) {
  console.warn('Reviews listener setup note:', e);
}

// Ensure initialization runs reliably even if DOM is already parsed
function runInitialSetup() {
  setTimeout(() => {
    if (typeof window.dismissSplashScreen === 'function') {
      window.dismissSplashScreen();
    }
  }, 1200);

  try {
    const savedRevs = localStorage.getItem('binRiazCustomerReviews');
    if (savedRevs) {
      window.customerReviews = JSON.parse(savedRevs);
    }
  } catch (e) {}
  if (typeof window.renderCustomerReviews === 'function') {
    window.renderCustomerReviews();
  }

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

  // Connect file inputs for both Gallery and Camera
  const gInput = document.getElementById('imageGalleryInput') as HTMLInputElement | null;
  const cInput = document.getElementById('imageCameraInput') as HTMLInputElement | null;
  const egInput = document.getElementById('editImageGalleryInput') as HTMLInputElement | null;
  const ecInput = document.getElementById('editImageCameraInput') as HTMLInputElement | null;
  if (gInput) gInput.addEventListener('change', () => window.handleImageFile(gInput));
  if (cInput) cInput.addEventListener('change', () => window.handleImageFile(cInput));
  if (egInput) egInput.addEventListener('change', () => window.handleEditImageFile(egInput));
  if (ecInput) ecInput.addEventListener('change', () => window.handleEditImageFile(ecInput));
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
