# Backend & Frontend Integration Analysis

This document provides a comprehensive analysis of the current state of both the Backend and Frontend codebases and outlines the exact gaps and mapping required to achieve full-stack integration for the DBT Leakage Detection System.

## 1. Current State of the Codebase

### 🏗️ Backend Setup (Node.js + Express + Sequelize)
The backend is fundamentally robust and well-structured, following a clear MVC pattern:
- **Authentication**: Fully implemented. Uses `bcryptjs` for password hashing and `jsonwebtoken` (JWT) for session management. 
- **Authorization**: Role-Based Access Control (RBAC) middleware (`authorize('ADMIN', 'DFO', 'VERIFIER', 'AUDITOR')`) is active and protecting routes.
- **Routing**: API endpoints are cleanly separated by role (e.g., `/api/dfo/*`, `/api/verifier/*`, `/api/audit/*`).
- **Database**: Configured via Sequelize ORM with models mapped out.

### 🎨 Frontend Setup (Next.js 16 + Tailwind CSS)
The frontend is visually complete and highly polished:
- **UI/UX**: Premium, high-contrast, Mac-inspired styling with `framer-motion` animations entirely implemented across all four role dashboards.
- **Mocked State**: Currently, all dashboard data relies on statically hardcoded arrays (e.g., `const totalLeakage = 15400000;`, `mockCases`).
- **Authentication**: The Login and Signup layouts are built, but the logic (`handleSignIn`) is stubbed with `alert()` and `console.log()` statements.

---

## 2. The Integration Gap (What is Missing?)

To connect the beautiful frontend UI to the functional backend API, the following structural components need to be implemented on the Frontend:

1. **API Client & Interceptors**
   - **Missing**: A centralized utility (like `axios` instance or a custom `fetch` wrapper) to handle API requests.
   - **Why**: Needed to automatically attach the `Authorization: Bearer <token>` header to all outgoing requests and handle 401/403 errors globally.

2. **Global Auth State Management**
   - **Missing**: React Context API or a lightweight state manager (like Zustand) to store the current user's session (`token`, `role`, `name`).
   - **Why**: So the UI knows *who* is logged in, changes the Navbar state, and persists sessions across page reloads using `localStorage` or cookies.

3. **Route Protection (Middleware)**
   - **Missing**: Next.js `middleware.ts` or client-side Route Guards.
   - **Why**: Currently, anyone can type `/dashboard/admin` in the URL and view the dashboard. We need logic to redirect unauthenticated users back to `/login`, and restrict roles (e.g., stopping a Verifier from accessing the Admin page).

4. **Dynamic Data Fetching**
   - **Missing**: `useEffect` hooks or data-fetching libraries (React Query / SWR) to pull live data.
   - **Why**: The hardcoded objects need to be replaced with state variables populated by API responses.

---

## 3. Frontend-to-Backend API Mapping Plan

Here is the exact mapping of Frontend UI events to Backend API endpoints that we will implement.

### 🔐 Authentication Flow
| Frontend Action | Backend Endpoint | Method | Payload / Action |
| :--- | :--- | :--- | :--- |
| Click "Sign Up" | `/api/auth/register` | `POST` | `{ name, email, password, role, district }` |
| Click "Log In" | `/api/auth/login` | `POST` | `{ email, password }` -> Returns JWT |
| Page Refresh | *(Local Storage/Cookies)* | `N/A` | Retrieve JWT, hydrate Auth context. |

### 📋 DFO Dashboard
| Frontend Component | Backend Endpoint | Method | Expected Data |
| :--- | :--- | :--- | :--- |
| Top 4 Stat Cards | `/api/dfo/stats` | `GET` | Total flags, High risk, Resolved counts. |
| High-Risk Cases List | `/api/dfo/cases` | `GET` | Array of anomaly cases for the DFO's district. |
| "Assign to Verifier" btn | `/api/cases/:id/assign` | `POST` | `{ verifierId }` |
| Verifier Dropdown List | `/api/dfo/verifiers` | `GET` | List of active field verifiers. |

### 🔍 Verifier Dashboard
| Frontend Component | Backend Endpoint | Method | Expected Data |
| :--- | :--- | :--- | :--- |
| Stat Cards | `/api/verifier/stats` | `GET` | Pending visits, completed tasks today. |
| Field Tasks (Accordion)| `/api/verifier/inbox` | `GET` | Array of pending beneficiary profiles to visit. |
| Verification Submit btn | `/api/cases/:id/verify`| `POST` | `{ isFraud, notes, locationGPS, photoUrl }` |

### 📊 Audit Dashboard
| Frontend Component | Backend Endpoint | Method | Expected Data |
| :--- | :--- | :--- | :--- |
| Stat Cards | `/api/audit/stats` | `GET` | Total leakage, recovered amount, flags. |
| Cross-Scheme Results | `/api/audit/duplicates` | `GET` | Array of multi-account/dual-benefit holders. |
| Advanced Query Builder | `/api/audit/duplicates` | `GET` | Filtered GET request using querystrings. *(Note: Backend `routes/index.js` currently comments out a dedicated POST query route; querying needs to rely on the GET filter).* |

### 🛡️ Admin Dashboard
| Frontend Component | Backend Endpoint | Method | Expected Data |
| :--- | :--- | :--- | :--- |
| Stat Cards | `/api/admin/summary` | `GET` | Global platform health metrics. |
| State Risk Heatmap | `/api/admin/heatmap` | `GET` | District-by-district severity scores. |
| Detector Rules List | `/api/admin/rules` | `GET` | Array of rules (e.g., Deceased Match, Dormant). |
| Toggle Rule Switch | `/api/admin/rules/:id` | `PATCH`| `{ enabled: boolean }` |

---

## Next Steps for Implementation
1. Install `axios` (optional, for cleaner API syntax).
2. Create `Frontend/context/AuthContext.tsx`.
3. Create `Frontend/lib/api.ts` for interceptors.
4. Implement `middleware.ts` for Next.js route protection.
5. Swap static lists in `page.tsx` files with API calls.
