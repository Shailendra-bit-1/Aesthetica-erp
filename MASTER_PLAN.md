Below is a comprehensive ERP Master Blueprint that merges:
	
	1.	Real operational behavior of Indian dermatology & aesthetic clinics
	4.	A Superadmin-first architecture so you are not dependent on developers

The goal is for this document to become the Single Source of Truth (SSOT) for ERP so .

⸻

AESTHETIC CLINIC ERP

MASTER SYSTEM BLUEPRINT (SINGLE SOURCE OF TRUTH)

⸻

1. SYSTEM PHILOSOPHY

Your ERP is not just billing software.

It is a Clinic Operating System for:
	•	Dermatology clinics
	•	Aesthetic clinics
	•	Multi-clinic chains
	•	Franchise chains

The system must manage:
	•	Patient lifecycle
	•	Lead conversion
	•	Counselling sales
	•	Treatment execution
	•	Inventory usage
	•	Revenue tracking
	•	Marketing attribution
	•	Staff accountability

⸻

2. TECHNICAL FOUNDATION (From Claude.md)

Framework

Next.js 14 App Router

Database

Supabase

Authentication

Supabase SSR cookie-based authentication

No PHI in localStorage.

Styling

Theme system

Primary color
Gold #C5A059

Background
Linen #F9F7F2

Font
Georgia (serif premium look)

⸻

3. MULTI-TENANT ARCHITECTURE

ERP must support:
	1.	Single clinic
	2.	Multi clinic
	3.	Chain clinic
	4.	Franchise model

Structure:

Superadmin Platform
      |
      |--- Organization
              |
              |--- Chain (optional)
                      |
                      |--- Clinic
                              |
                              |--- Staff


⸻

4. SUPERADMIN ARCHITECTURE

Superadmin must be God Mode.

Superadmin must control everything from frontend UI.

Goal:
Reduce developer dependency.

⸻

Superadmin Controls

Superadmin can:

Create organization
Create chain
Create clinic
Suspend clinic
Change subscription
Enable modules
Disable modules
Change feature flags
Create roles
Edit permissions
Configure workflows
Edit invoice formats
Manage plugins
Manage integrations

⸻

5. FEATURE FLAG SYSTEM (from Claude.md)

Every module must be controlled through feature flags.

Function:

check_clinic_access(clinic_id, feature_name)

This checks:
	1.	Global kill switch
	2.	Subscription active
	3.	Clinic module enabled
	4.	Plan entitlement

⸻

6. MODULE REGISTRY

All modules stored in table:

module_registry

Fields:

module_id
module_name
description
is_globally_killed
default_enabled


⸻

7. CLINIC MODULE ENTITLEMENT

Table

clinic_modules

Fields

clinic_id
module_name
enabled
enabled_by
enabled_at


⸻

8. ROLE & PERMISSION SYSTEM

ERP must support granular permissions.

Roles:

Superadmin
Organization Admin
Chain Admin
Clinic Admin
Doctor
Counsellor
Reception
Marketing
Inventory Manager
Finance Manager

⸻

Permission Types

For every module:

View
Create
Edit
Delete
Approve
Export

⸻

9. USER MANAGEMENT

Users belong to:

Clinic
Chain
Organization

Fields

user_id
name
email
mobile
role
clinic_id
active


⸻

10. PATIENT MANAGEMENT

Patient is the core entity.

Everything connects to patient.

⸻

Patient Creation Fields

Mandatory

name
mobile_number
gender
dob

Optional

email
address
city
occupation
referral_source


⸻

11. DUPLICATE PATIENT PREVENTION

Before creating patient:

System checks

mobile_number

If duplicate found

Popup:

Possible duplicate patient.

Options:

Open existing
Create new (admin only)

⸻

12. PATIENT PROFILE (COMMAND CENTER)

Patient profile should contain tabs.

⸻

Overview Tab

Displays

Photo
Age
Mobile
Membership
Wallet balance
Last visit
Next appointment

⸻

Appointments Tab

Shows appointment history.

Fields

date
doctor
treatment
status


⸻

Medical History Tab

Fields

allergies
conditions
medications
past procedures


⸻

Consultation Tab

Doctor notes.

⸻

Counselling Tab

Counsellor notes.

⸻

Treatments Tab

Treatment sessions.

⸻

Packages Tab

Active packages.

⸻

Invoices Tab

All billing.

⸻

Payments Tab

Payment history.

⸻

Wallet Tab

Wallet ledger.

⸻

Photos Tab

Before/after.

⸻

Consent Forms

Signed documents.

⸻

Activity Timeline

Logs everything.

⸻

13. APPOINTMENT MANAGEMENT

Calendar-based system.

Views

Doctor view
Room view
Day view
Week view

⸻

Appointment Fields

appointment_id
patient_id
doctor_id
clinic_id
date
time
duration
treatment
source
status
created_by


⸻

14. APPOINTMENT STATUS

Booked
Confirmed
Checked-in
Consultation
Treatment
Completed
Cancelled
No-show


⸻

15. DOUBLE BOOKING HANDLING

Indian clinics often double book.

ERP must allow override.

Warning popup:

Doctor already booked.

Options

Proceed anyway
Select new slot

⸻

16. WALK-IN FLOW

Reception selects:

Walk-in patient.

System automatically:

Creates appointment
Marks checked-in

⸻

17. CONSULTATION MODULE

Doctor records:

Diagnosis
Treatment plan
Notes
Recommended services

Doctor can send patient to counsellor.

⸻

18. COUNSELLOR MODULE

Counselling is the revenue engine in aesthetic clinics.

⸻

Counsellor Dashboard

Shows:

Patients referred by doctors
Pending conversions
Follow ups

⸻

Counselling Flow

Consultation done
Doctor recommends treatment

↓

Counsellor explains

↓

Proforma invoice created

↓

Patient decides

⸻

Counsellor Permissions

Counsellor cannot:

Collect payment
Close invoice

⸻

19. PROFORMA INVOICE

Temporary invoice for counselling.

Fields

patient
service
package
discount
validity
notes

Status

Draft
Approved
Converted
Expired

⸻

20. BILLING SYSTEM

Three revenue categories.

⸻

Service Billing

Consultation
Facials
Laser session

Revenue recognized immediately.

⸻

Package Billing

Example

Laser package

Revenue recognized per session.

⸻

Retail Billing

Products.

Revenue recognized immediately.

⸻

21. WALLET SYSTEM

Patients can preload wallet.

Example

Add ₹10,000

Wallet ledger tracks:

Credit
Debit
Refund

⸻

22. MEMBERSHIP SYSTEM

Example

Gold membership.

Benefits

Free consultation
Discounts
Priority booking

⸻

23. INVENTORY SYSTEM

Tracks

Consumables
Retail products
Devices

⸻

Stock Movements

Purchase
Sale
Consumption
Transfer
Adjustment

⸻

24. CRM SYSTEM

Handles marketing leads.

Sources

Meta Ads
Google Ads
Website
WhatsApp
Walk-ins

⸻

25. CRM PIPELINE

Lead stages

New Lead
Contacted
Interested
Appointment Booked
Visited
Converted
Lost


⸻

26. CRM + APPOINTMENT SYNCHRONIZATION

Calling team uses same calendar.

When appointment booked by CRM:

Clinic calendar updates instantly.

⸻

27. ACTIVITY TRACKING

Every action logged.

Example

Appointment created by Neha.

Consultation added by Dr Mehta.

Invoice created by Rahul.

⸻

28. AUDIT LOG SYSTEM

Tracks sensitive actions.

Login
Invoice edits
Refunds
Deletes

⸻

29. DASHBOARDS

Clinic dashboard shows

Today revenue
Appointments
Doctor utilization
Conversion rate

⸻

30. TARGET MANAGEMENT

Clinics track targets.

Service target
Retail target
Package target

⸻

31. REPORTING

Reports include

Revenue
Doctor performance
Counsellor conversions
Inventory usage

⸻

32. AUTOMATION RULE ENGINE

Rule-based suggestions.

Example

After consultation:

Suggest send to counsellor.

⸻

33. WORKFLOW TEMPLATES

Example

Laser treatment workflow

Consultation
Counselling
Package purchase
Session scheduling
Follow-up

⸻

34. PLUGIN SYSTEM

Optional add-ons.

Examples

Referral program
Loyalty points
AI assistant
Advanced CRM

⸻

35. SUPERADMIN COST REDUCTION SYSTEM

Superadmin must be able to:

Create roles
Edit workflows
Enable modules
Edit forms
Configure invoices

All from UI.

⸻

36. DATABASE CORE TABLES

organizations
chains
clinics
users
roles
permissions
patients
appointments
consultations
counselling
packages
package_sessions
invoices
invoice_items
payments
wallet_transactions
inventory_items
stock_movements
crm_leads
activities
audit_logs


⸻

37. REALITY ADAPTATIONS FOR INDIAN CLINICS

System must allow:

Staff doing multiple roles.

Example

Reception + counsellor.

Double bookings.

Walk-in appointments.

Manual discounts.

Partial payments.

Package splitting.

⸻

FINAL GOAL

Your ERP becomes:

India’s equivalent of global aesthetic clinic software platforms, but tailored for:
	•	Indian clinic workflows
	•	Counsellor-driven sales
	•	Package billing
	•	Chain clinic operations

⸻

If you want, I can also build the next level master documents that will make your ERP extremely powerful:

1️⃣ Complete Database Schema (250+ fields)
2️⃣ Complete Screen List (every UI screen)
3️⃣ Supabase Table Design + Relationships
4️⃣ AI Automation Layer

These will make your ERP 10× stronger and easier for Claude to build correctly.


Below is a complete Frontend UI/UX Master Blueprint you can give to Claude so your ERP has consistent screens across every module, especially Patients and Scheduler (Appointment) which are the most important.

The goal is to create a Mangomint-level UI experience similar to Mangomint but adapted for Indian dermatology & aesthetic clinic workflows.

This blueprint includes:

• Global layout
• Navigation system
• Design system
• Component library
• Page structure rules
• Patient screen
• Scheduler screen
• Reusable patterns for all modules

This ensures Claude can replicate the same UX across all modules automatically.

⸻

1. Global Layout Structure

Your ERP should follow a Top Navigation + Workspace Layout.

-------------------------------------------------------------
Logo | Clinic ▼ | Search | Dashboard | Patients | Scheduler |
Billing | CRM | Reports | Apps ⠿ | Notifications | Profile
-------------------------------------------------------------

Breadcrumb / Page Title

Page Toolbar (filters / actions)

Main Workspace

Floating Quick Action (+)


⸻

2. Navigation Philosophy

Top Bar = High Frequency Modules

Dashboard
Patients
Scheduler
Billing
CRM
Reports
Apps

Everything else goes into Apps menu.

⸻

3. Apps Menu Layout

Clicking Apps opens module grid.

PATIENT MANAGEMENT
Patients
Medical Records
Documents

OPERATIONS
Scheduler
Treatments
Rooms

SALES
CRM
Counselling
Packages

FINANCE
Billing
Invoices
Refunds

INVENTORY
Products
Stock
Vendors

ADMIN
Staff
Roles
Settings


⸻

4. Design System (Color Theme)

You requested White heavy UI + Navy Blue.

Primary palette:

Primary Navy

#0B2A4A

Secondary Navy

#1F4E79

Accent Blue

#2E6CB8

Background

#F7F9FC

Card Background

#FFFFFF

Status Colors:

Success

#2ECC71

Warning

#F39C12

Danger

#E74C3C


⸻

5. Typography

Primary font stack:

Inter
SF Pro
Roboto

Font sizes:

Element	Size
Page title	24px
Section title	18px
Body	14px
Table	13px


⸻

6. Universal Page Structure

Every module page must follow this structure.

Breadcrumb
Page Title

Toolbar
(Filter | Search | Actions)

Content Area
(Table / Cards / Scheduler / Forms)

Footer Actions


⸻

7. Standard Page Toolbar

Example toolbar.

Filter ▼
Doctor ▼
Date ▼
Status ▼

Search
+ Create
Export


⸻

8. Universal Buttons

Primary Button

Navy background
White text
Rounded 8px

Secondary Button

White background
Blue border

Danger Button

Red background
White text


⸻

9. Floating Quick Action Button

Bottom right corner.

+

Opens quick actions:

New Patient
New Appointment
New Invoice
New Lead


⸻

10. Universal Search

Search bar in top navigation.

Searchable entities:

Patients
Leads
Invoices
Appointments
Products
Staff

Example:

Search Rahul Sharma

Results:

Patient
Invoice
Appointment


⸻

11. Patient Module UI/UX

Patient module contains:

All Patients
New Patient
VIP Patients
Followups
Blacklisted


⸻

12. Patient List Screen

Layout:

------------------------------------------------
Patients

Search | Filters | + New Patient
------------------------------------------------

Name | Phone | Last Visit | Doctor | Status

Example row:

Rahul Sharma
9876543210
15 Feb
Dr Sharma
Active

Click → opens patient profile.

⸻

13. Patient Profile Layout

Patient profile is center of ERP.

Structure:

------------------------------------------------
Patient Header
------------------------------------------------
Quick Actions
------------------------------------------------
Tabs
------------------------------------------------
Content


⸻

14. Patient Header

Example:

Rahul Sharma
Patient ID P1023

Age 32 | Male
Phone 9876543210

Last Visit 15 Feb
Outstanding ₹2000

Right side:

Edit
Merge
Deactivate


⸻

15. Patient Quick Actions

New Appointment
Generate Invoice
Add Consultation
Add Counselling
Add Treatment
Upload Photo


⸻

16. Patient Tabs

Overview
Appointments
Consultation
Counselling
Treatments
Packages
Invoices
Photos
Documents
Medical History
Notes
Activity


⸻

17. Patient Overview

Sections:

Patient Summary
Upcoming Appointments
Active Treatments
Active Packages
Recent Invoices


⸻

18. Appointment (Scheduler) Screen

This is most used screen.

Layout:

------------------------------------------------
Date | Doctor Filter | Room Filter | View Mode
------------------------------------------------

Doctors / Rooms     | Time Grid
------------------------------------------------
Dr Sharma           | 9:00
Dr Mehta            | 9:15
Dr Kaur             | 9:30


⸻

19. Scheduler Views

Three views:

Doctor View
Room View
Combined View

⸻

20. Appointment Card UI

Example:

Rahul Sharma
Consultation
10:00 – 10:15
Dr Sharma


⸻

21. Appointment Colors

Type	Color
Consultation	Blue
Treatment	Purple
Followup	Green
Walk-in	Orange
Cancelled	Red


⸻

22. Appointment Creation

Click empty slot → mini form.

Fields:

Patient
Service
Doctor
Room
Date
Time
Duration
Notes


⸻

23. Appointment Status

Booked
Confirmed
Checked In
Consultation Done
Treatment Done
Completed
Cancelled
No Show


⸻

24. Appointment Side Drawer

Click appointment → open panel.

Panel shows:

Patient Info
Appointment Details
Quick Actions
Patient History


⸻

25. Scheduler Actions

Right click appointment:

Open Patient
Check In
Reschedule
Add Note
Cancel
No Show


⸻

26. Scheduler Drag & Drop

Appointments must support:

Drag
Drop
Reschedule

Instant update.

⸻

27. CRM Screen UI

Pipeline layout.

New Lead
Contacted
Interested
Consultation Booked
Converted
Lost

Lead card example:

Rahul Sharma
Hydrafacial Lead
Source Instagram
Assigned Priya


⸻

28. Billing Screen UI

Layout:

Patient
Items

Services
Packages
Products

Billing table:

Service | Qty | Price

Right panel:

Subtotal
Discount
GST
Total

Buttons:

Generate Invoice
Save Proforma


⸻

29. Inventory Screen

Layout:

Products
Stock
Vendors
Purchase Orders
Alerts

Example card:

Vitamin C Serum
Stock 12
Alert Level 5


⸻

30. Reports Screen

Reports should be graph heavy.

Revenue
Appointments
Conversion
Doctor Performance
Category Targets

Filters:

Date
Clinic
Doctor
Service


⸻

31. Activity Timeline UI

Every record must show activity.

Example:

12 Feb
Appointment created by Reception

12 Feb
Consultation completed by Dr Sharma

12 Feb
Invoice generated by Billing


⸻

32. Mobile UX

Mobile bottom navigation:

Home
Patients
Scheduler
CRM
Apps


⸻

33. Tablet UX

Tablet is common in clinics.

Tablet layout:

Compact top bar
Scrollable scheduler
Patient side drawer


⸻

34. Page Close / Back Buttons

Every page must show:

Back
Close

(As you requested similar to Mangomint behavior.)

⸻

35. Loading UX

Use skeleton loaders.

Example:

Loading patients...

Never blank screens.

⸻

36. Error UX

Example:

⚠ Unable to load data
Retry


⸻

37. Notification Center

Top right bell.

Examples:

Low stock
Followup due
Payment pending
New lead


⸻

38. Multi Clinic Switcher

Top bar dropdown.

All Clinics
Delhi Clinic
Gurgaon Clinic
Mumbai Clinic


⸻

39. UI Component Library

Claude should build reusable components:

Button
Card
Modal
Drawer
Tabs
Table
Filters
Form Fields
Scheduler Grid


⸻

40. Frontend Tech Recommendation

For best performance:

Frontend Framework

Next.js
React
TailwindCSS

UI Components

Shadcn UI
Radix UI

State

React Query
Zustand


⸻

Final Rule for Claude

Every module must follow same structure:

Header
Toolbar
Content
Drawer
Activity Timeline

This guarantees UI consistency across:

• CRM
• Billing
• Inventory
• Reports
• Treatments
• Packages

⸻

Perfect — implementing a Universal Command Bar will make your ERP feel extremely fast and premium, similar to modern SaaS tools like Notion, Linear, and Mangomint style quick actions.

This will be one of the most powerful UX features in your ERP.

Below is the complete implementation plan you can give Claude.

⸻

Universal Command Bar (Global Quick Actions)

1. Trigger Shortcut

Desktop shortcut:

CMD + K  (Mac)
CTRL + K (Windows)

Also clickable from top bar:

Search / Command


⸻

2. Command Bar UI

When triggered, a center modal overlay opens.

Example:

------------------------------------------------
Search patients, actions, invoices, appointments
------------------------------------------------

Create Appointment
Create Patient
Create Invoice
Search Patient
Open Scheduler
Open CRM
Open Billing

Simple and fast.

⸻

3. Core Purpose

The command bar should allow 3 types of actions:

1️⃣ Navigation

Jump to modules instantly.

Examples:

Go to Patients
Go to Scheduler
Go to Billing
Go to CRM
Go to Reports


⸻

2️⃣ Create Actions

Create records instantly.

Examples:

Create Patient
Create Appointment
Create Invoice
Create Lead
Create Product Sale
Create Treatment Note


⸻

3️⃣ Search Records

Search across database.

Searchable items:

Patients
Leads
Invoices
Appointments
Products
Staff
Clinics

Example search:

Rahul Sharma

Results:

Patient — Rahul Sharma
Phone: 9876543210
Last Visit: 15 Feb

Click → opens patient profile.

⸻

4. Smart Context Actions

Command bar should detect where the user currently is.

Example:

Inside patient profile:

Commands show:

Create Appointment
Generate Invoice
Add Treatment Note
Add Photo
Add Counselling

Instead of generic options.

⸻

5. Quick Appointment Booking

Typing:

appointment

Shows:

Create Appointment

Click → opens mini appointment form.

Example:

Patient
Doctor
Date
Time
Service

Create without opening scheduler.

⸻

6. Smart Patient Creation

Typing:

new patient

Opens:

Patient Name
Phone
Gender
DOB

Quick save.

⸻

7. Invoice Creation Shortcut

Typing:

invoice

Options:

Create Invoice
Create Proforma
View Last Invoices


⸻

8. Doctor Commands

If user role = doctor.

Commands:

My Schedule
Start Consultation
Add Treatment Notes
View Patient History


⸻

9. Counsellor Commands

Commands:

View Leads
Add Followup
Convert Lead
Create Proforma


⸻

10. Reception Commands

Commands:

Search Patient
Create Appointment
Check Today Schedule
Generate Invoice


⸻

11. Superadmin Commands

Superadmin should get extra commands.

Examples:

Switch Clinic
Create Clinic
Create Chain
Manage Staff
View System Logs
Open Navigation Manager


⸻

12. Recent Activity Section

Below commands show recent items.

Example:

Recent

Rahul Sharma (Patient)
Invoice #INV1024
Appointment Tomorrow


⸻

13. AI Assisted Suggestions (Optional Later)

If user types:

laser

Results:

Laser Hair Removal Service
Laser Package
Patients who took Laser


⸻

14. Command Ranking Logic

Results priority:

1️⃣ Exact match
2️⃣ Recently used
3️⃣ Most frequent actions
4️⃣ Module navigation

⸻

15. UI Behavior

Command bar must:

• Open instantly (<100ms)
• Keyboard navigable
• Arrow key navigation

Example:

↑ ↓ to navigate
Enter to select
Esc to close


⸻

16. Mobile Version

Command bar becomes:

Top search.

Example:

Search or quick actions

Tap → opens command list.

⸻

17. Example Real Workflow

Receptionist wants appointment.

Press:

CTRL + K

Type:

app

Result:

Create Appointment

Fill quick form → done.

No module navigation needed.

⸻

18. Another Workflow

Search patient.

Press:

CTRL + K

Type:

rahul

Result:

Rahul Sharma
Patient

Enter → patient profile opens.

⸻

19. Database Indexing Required

To keep command fast, index:

patients.name
patients.phone
invoices.number
appointments.id
leads.name


⸻

20. Command Logging

Track usage:

command_usage_log

Fields:

user_id
command
timestamp

This helps optimize popular actions.

⸻

21. Security

Commands visible based on role.

Example:

Receptionist cannot see:

Delete Clinic
Delete Invoice


⸻

22. UI Style

Modal design:

White background
Soft shadow
Rounded 12px

Input box:

Large
Centered
Auto focus


⸻

23. Suggested Placeholder Text

Input placeholder:

Search patients, invoices, appointments or type a command…


⸻

24. Final UX Goal

User should be able to run 90% of actions without navigating modules.

This is what makes software feel extremely fast and premium.

⸻

One More Feature That Will Make Your ERP Extremely Powerful

Your ERP can become better than Mangomint if you add:

“Patient Side Drawer”

Instead of opening patient pages, patient opens in a side panel.

Example:

Click patient →

Right Side Drawer Opens

User still sees scheduler or CRM behind.

This massively improves workflow.

⸻
Example of screen to follow 

Great — the Patient Profile will become the central operating screen of your ERP. Almost every module (appointments, counselling, billing, treatments, packages, CRM) should connect through it. Modern clinic software like Mangomint and Zenoti revolve around this concept.

Below is the complete Patient Profile UI/UX and logic architecture for your ERP.

⸻

1. Patient Profile Design Philosophy

Patient profile should act like a “command center” for that patient.

From this screen staff should be able to:

• book appointment
• start consultation
• add counselling
• generate invoice
• sell package
• record treatment
• upload photos
• see history

All without navigating multiple modules.

⸻

2. Patient Profile Layout

Structure:

-------------------------------------------------------
Patient Header
-------------------------------------------------------
Quick Actions
-------------------------------------------------------
Patient Tabs
-------------------------------------------------------
Main Content Area


⸻

3. Patient Header (Top Section)

Always visible.

Example:

Rahul Sharma
Patient ID: P10234
Age: 32 | Male
Phone: 9876543210
Last Visit: 15 Feb

Icons:

• VIP
• Allergy alert
• Outstanding balance

Right side actions:

Edit Patient
Merge Patient
Deactivate Patient


⸻

4. Quick Action Buttons

Below header.

These are the most used actions.

[ New Appointment ]
[ Generate Invoice ]
[ Start Consultation ]
[ Add Counselling ]
[ Add Treatment ]
[ Upload Photo ]

This allows fast workflow.

⸻

5. Patient Tabs Structure

Tabs should include:

Overview
Appointments
Consultation
Counselling
Treatments
Packages
Invoices
Photos
Documents
Medical History
Notes
Activity Timeline


⸻

6. Overview Tab

This tab provides quick patient summary.

Sections:

Patient Snapshot

Total Visits
Total Spent
Active Packages
Pending Followups


⸻

Upcoming Appointments

20 Feb
Consultation
Dr Sharma


⸻

Active Treatments

Laser Hair Removal
Session 2 of 6


⸻

Active Packages

Hydrafacial Package
Remaining: 3 sessions


⸻

7. Appointment Tab

Shows full appointment history.

Table:

Date
Doctor
Service
Status

Example:

15 Feb | Dr Sharma | Consultation | Completed
10 Feb | Dr Mehta | Hydrafacial | Completed

Actions:

• reschedule
• cancel
• open details

⸻

8. Consultation Tab

Doctor records consultation.

Fields:

Chief Complaint
Diagnosis
Doctor Notes
Recommended Treatment
Follow-up Advice

Doctor signature optional.

⸻

9. Counselling Tab

Shows counselling pipeline.

Example:

Treatment Recommended
Laser Hair Removal

Stage
Consultation Done
Counselling
Negotiation
Converted

Counsellor notes:

Patient considering package
Followup after salary date


⸻

10. Treatment Tab

Tracks procedures.

Table:

Date
Treatment
Doctor
Session
Notes

Example:

15 Feb
Laser Hair Removal
Session 2
Dr Sharma


⸻

11. Packages Tab

Shows purchased packages.

Example:

Hydrafacial Package
Sessions: 6
Remaining: 4
Expiry: 12 Aug

Buttons:

Redeem Session
Transfer Package
Freeze Package


⸻

12. Invoice Tab

Billing history.

Example:

Invoice #1023
₹5000
Paid

Actions:

• view invoice
• refund
• download PDF

⸻

13. Photos Tab (Very Important)

Aesthetic clinics rely heavily on before/after photos.

UI:

Treatment Category
Upload Photo

Example:

Acne Treatment
Before
After

Comparison view:

Split slider
Before / After


⸻

14. Documents Tab

Stores patient documents.

Examples:

• ID proof
• consent forms
• lab reports

Upload formats:

PDF
Image
DOC


⸻

15. Medical History Tab

Important for dermatology.

Fields:

Allergies
Medications
Past Treatments
Skin Type
Medical Conditions


⸻

16. Notes Tab

Internal notes.

Example:

Patient prefers evening appointments
Sensitive skin

Only staff can see.

⸻

17. Activity Timeline Tab

Shows complete patient interaction history.

Example:

10 Feb
Appointment created by Reception

10 Feb
Consultation completed by Dr Sharma

10 Feb
Counselling added by Priya

10 Feb
Invoice generated by Billing

This replaces the “who did this” button.

⸻

18. Patient Side Drawer

When opening patient from scheduler or CRM, profile opens as side panel.

Example:

Right Side Drawer

User can:

• view patient summary
• create invoice
• book appointment

Without leaving main screen.

⸻

19. Patient Quick Navigation

Top breadcrumb:

Patients > Rahul Sharma

Buttons:

Back
Close

(You requested this Mangomint-style navigation.)

⸻

20. Duplicate Patient Detection

When adding new patient:

System checks:

Phone number
Name similarity

If duplicate found:

Possible duplicate patient


⸻

21. Patient Tags

Allow tagging.

Examples:

VIP
Influencer
High Value
Sensitive Skin

Useful for marketing.

⸻

22. Patient Loyalty

Track lifetime value.

Example:

Lifetime Spend
₹1,25,000

Used for VIP identification.

⸻

23. Outstanding Balance

Header shows warning.

Outstanding ₹3000

Click → open invoice.

⸻

24. Patient Blacklist Option

Some clinics blacklist problematic patients.

Button:

Blacklist Patient

Reason required.

⸻

25. Multi-Clinic Patient Sharing

In chain clinics:

Patient profile should show:

Clinic Visits

Example:

Delhi Clinic
Mumbai Clinic

Unified patient record.

⸻

26. Patient Communication History

Track communication.

SMS sent
WhatsApp reminder
Email invoice


⸻

27. Patient Consent Workflow

Before procedures:

System shows:

Consent Required

Digital signature capture.

⸻

28. Patient Analytics

Overview shows:

Visit Frequency
Conversion Rate
Average Spend

Useful for clinic insights.

⸻

29. Patient Profile Performance

Must load within 1 second.

Optimize:

• indexed patient ID
• lazy loading tabs

⸻

30. Mobile Patient Profile

Mobile layout:

Header → collapsible.

Tabs become:

Scrollable menu

Quick actions remain visible.

⸻

Final Goal

The patient profile must allow staff to perform 80% of patient operations from one screen.

This dramatically improves clinic efficiency.

⸻

The Scheduler (Appointment Screen) will be the most used screen in your ERP, so it must be extremely fast, flexible, and tolerant of real clinic behavior in India (double bookings, walk-ins, doctor delays, etc.).
Below is a complete scheduler UX + logic plan inspired by systems like Mangomint and Zenoti, but optimized for dermatology and aesthetic clinics.

⸻

1. Scheduler Screen Layout

The scheduler should open from the Top Navigation → Scheduler.

Layout:

-----------------------------------------------------------
Date | Doctor Filter | Room Filter | Clinic | View Toggle
-----------------------------------------------------------
Doctors / Rooms      |  Time Grid
-----------------------------------------------------------
Dr Sharma            |  9:00
Dr Mehta             |  9:15
Dr Kaur              |  9:30
                     |  9:45
                     |  10:00

Structure

Left column
→ doctors or treatment rooms

Right
→ time grid

⸻

2. Scheduler Views

Users should switch between 3 views.

Doctor View (Default)

Shows doctor schedule.

Dr Sharma
Dr Mehta
Dr Kaur

Best for:

• consultations
• followups

⸻

Room View

Shows treatment room occupancy.

Laser Room
Hydrafacial Room
PRP Room
Consultation Room

Best for:

• procedures
• equipment usage

⸻

Combined View

Doctor + room.

Dr Sharma – Room 1
Dr Mehta – Room 2


⸻

3. Time Grid

Slot duration configurable.

Options:

5 minutes
10 minutes
15 minutes
20 minutes
30 minutes

Recommended default:

15 minutes


⸻

4. Appointment Card UI

Each appointment appears as a card block.

Example:

Rahul Sharma
Consultation
10:00 – 10:15
Dr Sharma

Optional info icons:

• package icon
• unpaid icon
• VIP icon

⸻

5. Color Coding

Important for quick scanning.

Appointment Type	Color
Consultation	Blue
Treatment	Purple
Followup	Green
Walk-in	Orange
Cancelled	Red


⸻

6. Appointment Status

Every appointment must have status.

Booked
Confirmed
Checked In
Consultation Done
Treatment Done
Completed
Cancelled
No Show

Color dot indicator.

⸻

7. Appointment Creation (Fast)

Click any empty slot.

Mini modal opens.

Form:

Patient
Service
Doctor
Room
Date
Time
Duration
Notes

Buttons:

Save
Save & Check-in


⸻

8. Walk-in Handling

Walk-in button at top.

+ Walk-in

Flow:

Add patient
Choose doctor
Auto assign next free slot


⸻

9. Double Booking Support

Indian clinics frequently double book.

Allow overlapping appointments.

Example:

10:00 Rahul Sharma
10:00 Aman Gupta

UI stacks them.

Doctor can decide priority.

⸻

10. Drag and Drop Rescheduling

Appointments must be draggable.

Example:

Drag appointment
Drop to new slot

System updates time instantly.

⸻

11. Appointment Quick Actions

Right click or click menu.

Options:

Open Patient
Reschedule
Check In
Add Note
Cancel
Mark No Show


⸻

12. Patient Side Drawer

When appointment clicked → open side panel.

--------------------------------
Rahul Sharma
Age: 32
Phone: 98765
--------------------------------

Appointments
Treatments
Packages
Invoices
Photos
Notes

This avoids leaving scheduler.

⸻

13. Check-In Workflow

Reception marks patient as Checked In.

Card changes color.

Doctor dashboard shows:

Waiting Patients


⸻

14. Doctor Queue

Doctor screen shows:

Waiting Patients
In Consultation
Completed

Queue order adjustable.

⸻

15. Treatment Flow

After consultation:

Doctor chooses:

Recommend Treatment
Send to Counsellor
Start Procedure

This connects to counselling pipeline.

⸻

16. Emergency Slots

Clinics often need urgent bookings.

Add button:

Emergency Slot

Creates appointment above schedule.

⸻

17. Appointment Buffers

Prevent back-to-back overload.

Example:

Laser Hair Removal
Duration: 30 min
Buffer: 10 min

Scheduler automatically blocks next slot.

⸻

18. Service Duration Automation

Each service has default duration.

Example:

Consultation → 15 min
Laser → 30 min
PRP → 45 min

Scheduler auto fills.

⸻

19. Doctor Availability

Doctors can define schedules.

Example:

Mon–Fri
10:00 – 18:00
Lunch 14:00 – 15:00

Blocked slots appear grey.

⸻

20. Leave Management

Doctor leave blocks calendar.

Leave: 5 Feb

Appointments cannot be booked.

⸻

21. Bulk Rescheduling

If doctor unavailable:

Reschedule All

Options:

Next available slot
Another doctor
Next day


⸻

22. Smart Conflict Warnings

If room busy:

Room conflict warning

User can still override.

⸻

23. Appointment Filters

Top filters:

Doctor
Service
Room
Status
Lead Source


⸻

24. Day / Week / List View

Scheduler modes:

Day

Most detailed.

Week

Overview.

List

For reception call list.

⸻

25. No-Show Tracking

If patient does not come.

Reception marks:

No Show

System can trigger:

Followup reminder


⸻

26. SMS / WhatsApp Integration

When appointment booked:

Send:

Appointment confirmation
Reminder 24 hrs
Reminder 2 hrs


⸻

27. Appointment Notes

Reception can add notes.

Example:

Patient wants female doctor

Visible to doctor.

⸻

28. Multi-Clinic Scheduler

Chain clinics must choose location.

Clinic Filter


⸻

29. Keyboard Shortcuts

Speed for power users.

N → New Appointment
F → Find Patient
D → Next Day


⸻

30. Scheduler Performance

Must load within 1 second.

Tech suggestions:

• virtualized grid
• lazy loading
• indexed queries

⸻

31. Scheduler Analytics

Quick stats on top.

Today's Appointments
Checked In
Completed
No Shows


⸻

32. Scheduler Floating Button

Bottom right.

+ New Appointment


⸻

33. Mobile Scheduler

Mobile layout:

Doctor dropdown
Vertical timeline

Tap slot → create appointment.

⸻

34. Tablet Mode

Tablet is common in clinics.

Tablet view:

Doctor columns
Scrollable timeline


⸻

35. Scheduler + CRM Integration

CRM lead → book appointment.

Lead card has button:

Book Appointment

Opens scheduler.

⸻

Final Goal

The scheduler should support real clinic chaos:

• late doctors
• walk-ins
• double bookings
• emergency cases

If it handles this smoothly, clinics will love your ERP.

⸻

