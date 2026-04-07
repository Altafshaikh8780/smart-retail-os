# 🧠 Smart Retail OS – Offline-First Retail Management System

Smart Retail OS is a modern, offline-first retail management application designed to handle inventory, billing, customers, analytics, and employee workflows — all in one system.

Built using **React + TypeScript + Vite**, this system is optimized for performance, scalability, and real-world retail usage.

---

## 🚀 Features

### 🏪 Inventory Management

* Add, edit, delete products
* Product categories
* Stock tracking
* Product image management (Cloudinary support)
* Second-hand product module

### 💸 Billing & Checkout

* Create invoices
* Add products to cart
* Automatic calculations (subtotal, tax, grand total)
* Customer-linked billing
* PDF invoice generation

### 👤 Customer Management

* Add and manage customers
* Track purchase history

### 📊 Analytics Dashboard

* Sales overview
* Revenue tracking
* Product performance insights

### 👨‍💼 Employee Management

* Admin & Employee roles
* Role-based permissions
* Secure authentication

### 🔄 Offline-First System

* Works without internet
* Sync queue for pending actions
* Auto-sync when back online

### 📁 Reports & Export

* CSV export
* Clean invoice formatting
* Structured file naming

---

## 🧱 Tech Stack

* **Frontend:** React + TypeScript + Vite
* **State Management:** Custom hooks / stores
* **Styling:** Tailwind CSS
* **Database (Local):** IndexedDB / Local Storage
* **Cloud Integration:** Firebase (optional)
* **File Storage:** Cloudinary
* **Deployment:** Vercel

---

## 📂 Project Structure

```
Smart_retail_os/
│
├── public/                # Static assets
├── src/
│   ├── components/        # UI components
│   ├── pages/             # App pages (Dashboard, Inventory, etc.)
│   ├── layouts/           # Layouts (Admin panel, etc.)
│   ├── hooks/             # Custom hooks
│   ├── lib/               # Core logic (auth, firebase, pdf, etc.)
│   ├── store/             # State management
│   ├── scripts/           # Seed/reset scripts
│   └── assets/            # Images and icons
│
├── .env                   # Environment variables (NOT committed)
├── package.json
└── vite.config.ts
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the repository

```
git clone https://github.com/Altafshaikh8780/smart-retail-os.git
cd smart-retail-os
```

---

### 2️⃣ Install dependencies

```
npm install
```

---

### 3️⃣ Setup environment variables

Create a `.env` file in root:

```
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_API_URL=your_api_url
```

⚠️ Do NOT commit `.env` file

---

### 4️⃣ Run the project

```
npm run dev
```

App will run on:

```
http://localhost:5173
```

---

### 5️⃣ Build for production

```
npm run build
```

---

### 6️⃣ Preview production build

```
npm run preview
```

---

## ☁️ Deployment (Vercel)

1. Push code to GitHub:

```
git push origin main
```

2. Go to Vercel

3. Import repository

4. Configure:

   * Build Command: `npm run build`
   * Output Directory: `dist`

5. Add environment variables in Vercel dashboard

6. Deploy 🚀

---

## 🔐 Authentication Notes

* Uses role-based authentication
* Admin has full access
* Employees have restricted permissions

---

## 🔄 Offline Sync Logic

* All actions stored locally first
* Sync queue manages pending operations
* Auto-sync triggers when internet is restored

---

## ⚠️ Important Notes

* SQLite is NOT used on Vercel backend
* Use Firebase or cloud APIs for production sync
* Images should be stored using Cloudinary or similar service

---

## 🧪 Testing Checklist

* Add/Edit/Delete product
* Generate invoice
* Export CSV
* Offline → Online sync
* Role-based access control

---

## 🔮 Future Enhancements

* Barcode scanning
* Multi-store support
* AI-based inventory prediction
* Mobile app version

---

## 👨‍💻 Author

**Altaf Shaikh**
GitHub: https://github.com/Altafshaikh8780

---

## 📜 License

This project is for educational and academic purposes.
