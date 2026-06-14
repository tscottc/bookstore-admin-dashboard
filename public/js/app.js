import { auth, onAuthStateChanged, signOutUser, getUserDoc, createUserDoc } from './firebase.js';
import { initAuth } from './components/auth.js';
import { initNav } from './components/nav.js';
import { mountHome, unmountHome } from './pages/home.js';
import { mountShifts, unmountShifts } from './pages/shifts.js';
import { mountResources } from './pages/resources.js';
import { mountRoster, unmountRoster } from './pages/roster.js';
import { mountProfile } from './pages/profile.js';
import { mountApprovals, unmountApprovals } from './pages/approvals.js';
import { mountHours, unmountHours } from './pages/hours.js';

let currentUserData = null;
let currentRoute = null;
let authController = null;
let navController = null;

const ROUTES = ['home', 'shifts', 'hours', 'resources', 'roster', 'profile', 'approvals'];
const ADMIN_ROUTES = ['approvals'];

const unmounters = {
  home: unmountHome,
  shifts: unmountShifts,
  hours: unmountHours,
  roster: unmountRoster,
  approvals: unmountApprovals,
};

function navigate(route) {
  if (!ROUTES.includes(route)) route = 'home';
  if (ADMIN_ROUTES.includes(route) && currentUserData?.role !== 'admin') route = 'home';

  if (currentRoute && unmounters[currentRoute]) unmounters[currentRoute]();

  currentRoute = route;
  window.location.hash = `#/${route}`;
  navController.setActive(route);

  const content = document.getElementById('content-area');
  content.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'page-enter';
  content.appendChild(page);

  switch (route) {
    case 'home':      mountHome(page, currentUserData); break;
    case 'shifts':    mountShifts(page, currentUserData); break;
    case 'hours':     mountHours(page, currentUserData); break;
    case 'resources': mountResources(page); break;
    case 'roster':    mountRoster(page); break;
    case 'profile':   mountProfile(page, currentUserData); break;
    case 'approvals': mountApprovals(page, currentUserData); break;
  }
}

function routeFromHash() {
  const hash = window.location.hash.replace('#/', '').split('?')[0];
  return ROUTES.includes(hash) ? hash : 'home';
}

async function handleAuthStateChange(user) {
  if (!user) {
    currentUserData = null;
    document.getElementById('app-shell').style.display = 'none';
    authController.show();
    authController.showView('login');
    return;
  }

  let userDoc = await getUserDoc(user.uid);

  if (!userDoc) {
    // Edge case: auth exists but Firestore doc missing (race or error)
    userDoc = {
      email: user.email,
      uid: user.uid,
      approved: false,
      denied: false,
      role: 'employee',
      displayName: user.email,
    };
    try {
      await createUserDoc(user.uid, userDoc);
    } catch (e) {
      console.error('createUserDoc error:', e);
    }
    await signOutUser();
    authController.show();
    authController.showView('pending');
    return;
  }

  if (!userDoc.approved) {
    await signOutUser();
    authController.show();
    authController.showView(userDoc.denied ? 'denied' : 'pending');
    return;
  }

  // Approved — enter app
  currentUserData = userDoc;
  authController.hide();
  document.getElementById('app-shell').style.display = 'flex';
  navController.setUser(userDoc, user.email);
  navigate(routeFromHash());
}

document.addEventListener('DOMContentLoaded', () => {
  authController = initAuth();
  navController = initNav(navigate);

  window.addEventListener('hashchange', () => {
    if (!currentUserData) return;
    const newRoute = routeFromHash();
    if (newRoute !== currentRoute) navigate(newRoute);
  });

  onAuthStateChanged(auth, handleAuthStateChange);
});
