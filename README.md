# SDO Attendance System

The SDO Attendance System is a web-based attendance management platform developed as an **internship project** for the **Schools Division Office (SDO), Quezon City**. The system is designed to modernize and streamline the manual process of tracking employee attendance within the division, providing a structured and reliable solution tailored to the needs of a government education office.

Built using **Next.js 16** (App Router) for a modern and performant full-stack application, **Supabase** for secure authentication and scalable database management, and **Tailwind CSS** for a clean and responsive user interface, the project reflects industry-standard development practices applied in a real-world government setting. The codebase is written in **TypeScript** and tested with **Vitest**.

The platform supports two distinct roles — **administrators** and **regular users** — each with a dedicated interface and set of capabilities. Employees can clock in and out using **QR code–based attendance**, while administrators have oversight through tools for managing **work schedules**, reviewing **attendance correction requests**, and accessing **analytics**, **calendar views**, and **reporting** (including DTR-style document export).

## Tech stack

| Area | Technologies |
|------|----------------|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router), [React 19](https://react.dev/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/) |
| **Backend / data** | [Supabase](https://supabase.com/) (Auth, PostgreSQL) |
| **Charts** | [Recharts](https://recharts.org/) |
| **QR & documents** | QR code generation, Word (`.docx`) templates for DTR export |
| **Testing** | [Vitest](https://vitest.dev/) |
