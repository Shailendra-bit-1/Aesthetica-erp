Below is a complete architectural blueprint for your Aesthetic / Dermatology Clinic ERP SaaS, designed specifically for single clinics and multi-branch chains.

This architecture ensures:
	•	No duplicate data
	•	All modules work in sync
	•	Real clinic workflow
	•	High speed operations
	•	Low infrastructure cost
	•	Easy to scale like platforms such as Zenoti, Mangomint, Clinicea and Aesthetic Record.

⸻

Aesthetic Clinic ERP – Complete Architecture Blueprint

⸻

1. Core System Architecture

Architecture Style

SaaS Multi-Tenant ERP

Each clinic has:

tenant_id

All data is linked to:

tenant_id
branch_id

Example:

patients
appointments
invoices
forms
treatments
inventory

Every table includes:

tenant_id
branch_id

This allows:
	•	single clinic
	•	multi clinic chains
	•	franchise clinics

⸻

2. Core System Layers

Your ERP should have 5 layers

1️⃣ Data Layer

Database (Supabase/Postgres)

Core Tables:

patients
appointments
treatments
services
packages
credits
forms
form_responses
inventory
invoices
payments
wallet
membership
loyalty
crm_leads
before_after
workflow_rules
automation_logs


⸻

2️⃣ Business Logic Layer

Handles all ERP logic

Examples:

appointment lifecycle
package credit deduction
inventory deduction
wallet accounting
workflow triggers

Example logic:

Treatment completed
→ deduct package credit
→ deduct inventory
→ store before/after
→ update patient journey
→ update revenue dashboard


⸻

3️⃣ Automation Layer

Rule Engine + Workflow Engine

Handles:

triggers
conditions
actions

Example:

Trigger
Appointment booked

Action
Send WhatsApp confirmation


⸻

4️⃣ Application Layer

All modules visible to clinic users.

Modules communicate through events.

Example:

billing module
→ emits invoice_created event

CRM listens to this event.

⸻

5️⃣ Integration Layer

External integrations.

Example:

Razorpay
WhatsApp
Meta Ads
Google Ads
Payment QR


⸻

3. Core Modules Architecture

Your ERP should contain these 12 core modules

⸻

Module 1 — CRM & Lead Management

Purpose:

Capture and convert leads.

Sources:

website
instagram ads
facebook ads
whatsapp
walk-in
phone

Data stored:

lead_id
source
interest
assigned_staff
status

Lead statuses:

new
contacted
consultation booked
consultation done
converted
lost

When converted:

patient profile created


⸻

Module 2 — Patient Management

Patient Profile is central system record

Patient profile contains:

personal info
medical history
all treatments
all invoices
wallet balance
membership
loyalty points
before after photos
forms
documents

Unique rule:

mobile number must be unique

If duplicate mobile detected:

show merge suggestion


⸻

Module 3 — Appointment Management

Appointment lifecycle:

Available
↓
Booked
↓
Confirmed
↓
Checked-in
↓
Consultation
↓
Treatment
↓
Completed
↓
No-show
↓
Cancelled

Appointment linked to:

patient
doctor
room
device
service


⸻

Module 4 — Counselling Module

Used by:

counsellor
doctor

Flow:

Consultation
↓
Treatment plan suggested
↓
Package options shown
↓
Cost estimate generated
↓
Patient decision

If patient accepts:

invoice created
package activated


⸻

Module 5 — Services & Packages

Services example:

Laser hair removal
Hydrafacial
PRP
Botox

Packages example:

Laser hair removal 6 sessions
Acne treatment 4 sessions

System creates:

service credits

Example:

6 session package
→ 6 credits

When treatment done:

credit deducted


⸻

Module 6 — EMR & Form Engine

Your Universal Medical Form Engine

Forms:

medical history
consultation
treatment notes
consent forms
follow up forms

Forms linked to:

appointment
treatment
patient

Forms should support:

conditional fields
auto fill
templates


⸻

Module 7 — Visual Charting System

Example:

face mapping
body mapping
hair scalp mapping

Doctor can mark:

pigmentation
acne
wrinkles
hair thinning

Linked to:

treatment plan
before after comparison


⸻

Module 8 — Treatment Execution

During treatment:

Doctor records:

device settings
dosage
notes
consumables

Example:

laser energy level
PRP ml
needle type

System updates:

inventory
credits
treatment history


⸻

Module 9 — Billing & Payments

Invoice contains:

services
packages
products
membership
wallet usage
discounts
tax

Payment methods:

cash
card
UPI
Razorpay
wallet

Invoice states:

draft
pending
paid
refunded


⸻

Module 10 — Wallet / Membership / Loyalty

Wallet:

prepaid balance

Membership:

discount rules
priority booking

Loyalty:

reward points

Example rule:

₹100 spent = 1 point


⸻

Module 11 — Inventory

Types:

consumables
retail products
devices

Example:

PRP kit
serum
laser gel

Treatment mapped with inventory.

Example:

PRP treatment
→ deduct PRP kit
→ deduct syringe


⸻

Module 12 — Reporting & Dashboard

Dashboard shows:

daily revenue
treatments done
conversion rate
top services
inventory alerts
staff performance


⸻

4. Role & Permission System

Roles:

super admin
clinic owner
doctor
counsellor
therapist
receptionist
accountant

Example permissions:

Receptionist:

appointments
patients
billing

Doctor:

EMR
treatments
charting

Counsellor:

CRM
treatment plans
follow ups


⸻

5. Automation Engine

Your Rule Builder

Structure:

trigger
condition
action

Example:

Trigger
Treatment completed

Action
Send follow up message


⸻

6. Workflow Engine

Workflow manages multi-step processes

Example workflow:

Lead
↓
Consultation
↓
Treatment plan
↓
Invoice
↓
Treatment
↓
Follow up


⸻

7. Patient Journey Engine

All events stored in:

patient timeline

Example timeline:

Lead created
Consultation done
Package purchased
Treatment session 1
Follow up


⸻

8. Data Integrity Rules

Critical system checks:

mobile number unique
invoice cannot be deleted after payment
treatment cannot complete without doctor
inventory cannot go negative
package credit cannot exceed limit


⸻

9. Before / After Image Logic

Image captured once.

Stored in:

treatment record

Automatically shown in:

before after gallery
patient record
treatment history

Avoid duplicate storage.

⸻

10. Financial Accounting Logic

Revenue types:

treatment revenue
product revenue
membership revenue
wallet liability

Wallet recharge:

liability

Revenue only when used.

⸻

11. Data Synchronization

All modules communicate through events

Example:

appointment_completed
invoice_paid
treatment_done
wallet_used


⸻

12. Multi Branch Architecture

Each record includes:

tenant_id
branch_id

Allows:

branch wise reports
central inventory
multi clinic dashboard


⸻

13. Performance Design

To keep ERP fast:

Use:

indexed queries
async workflows
caching
background jobs


⸻

14. Security Architecture

Security layers:

row level security
role permissions
audit logs

Audit example:

who edited invoice
who changed treatment


⸻

15. Core Principle

Your ERP must follow one golden rule

Capture data once
Reuse everywhere

Example:

Before photo captured
→ treatment record
→ gallery
→ patient profile

No duplication.

⸻

Final System Flow

Lead
↓
Consultation
↓
Treatment plan
↓
Package purchase
↓
Treatment sessions
↓
Follow ups
↓
Retention


⸻

Your Counsellor Module should act like a sales + treatment planning bridge between CRM → Doctor → Billing → Treatment.
In real aesthetic clinics this step is critical for revenue, and systems like Zenoti and Aesthetic Record design their workflow around this.

Below is the complete architecture for your Counselling Module so it works cleanly with roles, permissions, patient record, pipeline, conversion, billing, and treatment execution.

⸻

1. Core Purpose of Counsellor Module

The counsellor module should handle:

Consultation discussion
Treatment planning
Package explanation
Pricing discussion
Follow-ups
Conversion tracking

But counsellor should NOT handle money or close invoices.

So system roles must enforce this.

⸻

2. Role Responsibilities

Counsellor Role

Counsellor can:

View patient profile
View consultation notes
Create treatment plan
Suggest services/packages
Create cost estimate
Create proforma invoice
Add follow-up tasks
Move pipeline stages

Counsellor cannot:

collect payment
close invoice
edit medical records
complete treatment


⸻

Doctor Role

Doctor can:

perform consultation
update diagnosis
approve treatment plan
edit treatment parameters
add treatment protocols
view counselling suggestions

Doctor cannot:

close financial invoice
edit payment records


⸻

Reception / Billing Role

Reception can:

convert proforma → invoice
collect payment
apply discounts
activate package

Reception cannot:

edit doctor notes
edit medical forms


⸻

3. Counselling Workflow (Real Clinic Flow)

The counselling workflow should follow this pipeline.

Consultation
↓
Counselling
↓
Treatment Plan
↓
Cost Estimate
↓
Patient Decision
↓
Conversion
↓
Billing
↓
Treatment Execution


⸻

4. Counselling Record Creation

Counselling starts after:

Appointment status = consultation done

System creates:

counselling_record

This record contains:

patient_id
doctor_id
counsellor_id
consultation_id
diagnosis
concerns
recommended treatments
estimated cost
status


⸻

5. Counselling Pipeline Stages

Your ERP should show a pipeline board for counsellors.

Stages:

Consultation Done
Treatment Suggested
Cost Discussed
Thinking
Follow-up
Converted
Lost

Each patient moves through this pipeline.

⸻

6. Treatment Suggestion Structure

Counsellor can add:

services
packages
products

Example:

Concern: Acne scars

Suggested treatments:
Microneedling – 4 sessions
PRP add-on – 4 sessions
Homecare products

System creates:

treatment_plan


⸻

7. Cost Estimate / Proforma Invoice

Counsellor generates:

proforma invoice

Important rule:

Proforma ≠ Invoice

Proforma contains:

services
packages
products
discount
total cost

But:

no payment allowed


⸻

8. Patient Decision States

Patient can respond in 4 ways.

Accepted
Partial accepted
Thinking
Rejected


⸻

9. Full Conversion Flow

If patient accepts full plan.

System flow:

Proforma → Invoice
Invoice → Payment
Package → Activated
Treatment → Scheduled

System actions:

create invoice
activate package credits
add to patient treatment history


⸻

10. Partial Conversion Logic

Very common in clinics.

Example:

Doctor suggested:

PRP – 4 sessions
Laser – 6 sessions

Patient agrees only to:

PRP – 2 sessions

ERP should allow:

edit proforma
remove items
convert selected items

Result:

partial conversion

Pipeline status:

partially converted

Remaining treatments stay in pipeline.

⸻

11. Follow-up System

If patient does not convert immediately.

Counsellor schedules follow-ups.

Example follow-up timings:

3 days
7 days
15 days
30 days

Follow-up reminders:

WhatsApp
SMS
Task alerts

Example message:

Hi {{name}}, just checking if you had any questions about the treatment plan suggested by our doctor.


⸻

12. Counselling Notes

Counsellor must record:

patient concerns
budget
objections
timeline
decision stage

Example:

Patient concerned about cost
Prefers EMI option
Wants to start next month


⸻

13. Patient Profile Integration

In Patient Profile → Counselling Tab

Doctor and staff can see:

consultation notes
treatment plan
proforma estimates
conversion status
follow-ups

Timeline example:

Consultation done
Counselling completed
Treatment plan suggested
Proforma created
Follow-up scheduled
Converted


⸻

14. Doctor Visibility

Doctor should see counselling summary inside patient profile.

Example panel:

Counselling Summary

Suggested Treatments:
PRP – 4 sessions
Microneedling – 3 sessions

Status:
Patient thinking
Follow-up in 3 days

Doctor can:

edit treatment plan
add new treatments


⸻

15. Conversion → Treatment Flow

Once converted:

System creates:

active treatments
package credits
treatment sessions

Patient now moves to:

treatment module


⸻

16. Billing Integration

Important rule:

Counsellor cannot collect payment

Process:

Counsellor → creates proforma
Reception → converts to invoice
Reception → collects payment

Invoice linked to:

treatment plan
package
patient record


⸻

17. Counsellor Performance Dashboard

Your ERP should track:

Metrics:

leads handled
consultations done
conversion rate
revenue generated
follow-up efficiency

Example dashboard:

Consultations: 40
Converted: 18
Conversion rate: 45%
Revenue: ₹8,40,000


⸻

18. Counselling Data Tables

Database entities required:

counselling_records
treatment_plans
proforma_invoices
followup_tasks
conversion_logs


⸻

19. Important ERP Logic Rules

Your ERP must enforce these rules.

Counsellor cannot close invoice
Counsellor cannot collect payment
Doctor must approve treatment
Treatment cannot start without invoice
Package credits must exist before session


⸻

20. Real Patient Journey Example

Example real flow.

Patient books consultation
↓
Doctor consultation done
↓
Counsellor discussion
↓
Treatment plan created
↓
Proforma estimate shared
↓
Patient thinking
↓
Follow-up after 3 days
↓
Patient agrees
↓
Invoice generated
↓
Payment collected
↓
Package activated
↓
Treatment session scheduled

Everything stored in patient timeline.

⸻

Final System Design Principle

Your counselling module should behave like a sales CRM embedded inside ERP.

It connects:

CRM
↓
Consultation
↓
Counselling
↓
Billing
↓
Treatment


⸻

If you want, I can also show you one extremely powerful design improvement:

“Revenue Opportunity Engine”

This automatically shows clinics:

Patients who didn't convert
Patients with unused packages
Patients due for follow-up

This single feature can increase clinic revenue by 20-30% if implemented correctly.

Your Counsellor Module should act like a sales + treatment planning bridge between CRM → Doctor → Billing → Treatment.
In real aesthetic clinics this step is critical for revenue, and systems like Zenoti and Aesthetic Record design their workflow around this.

Below is the complete architecture for your Counselling Module so it works cleanly with roles, permissions, patient record, pipeline, conversion, billing, and treatment execution.

⸻

1. Core Purpose of Counsellor Module

The counsellor module should handle:

Consultation discussion
Treatment planning
Package explanation
Pricing discussion
Follow-ups
Conversion tracking

But counsellor should NOT handle money or close invoices.

So system roles must enforce this.

⸻

2. Role Responsibilities

Counsellor Role

Counsellor can:

View patient profile
View consultation notes
Create treatment plan
Suggest services/packages
Create cost estimate
Create proforma invoice
Add follow-up tasks
Move pipeline stages

Counsellor cannot:

collect payment
close invoice
edit medical records
complete treatment


⸻

Doctor Role

Doctor can:

perform consultation
update diagnosis
approve treatment plan
edit treatment parameters
add treatment protocols
view counselling suggestions

Doctor cannot:

close financial invoice
edit payment records


⸻

Reception / Billing Role

Reception can:

convert proforma → invoice
collect payment
apply discounts
activate package

Reception cannot:

edit doctor notes
edit medical forms


⸻

3. Counselling Workflow (Real Clinic Flow)

The counselling workflow should follow this pipeline.

Consultation
↓
Counselling
↓
Treatment Plan
↓
Cost Estimate
↓
Patient Decision
↓
Conversion
↓
Billing
↓
Treatment Execution


⸻

4. Counselling Record Creation

Counselling starts after:

Appointment status = consultation done

System creates:

counselling_record

This record contains:

patient_id
doctor_id
counsellor_id
consultation_id
diagnosis
concerns
recommended treatments
estimated cost
status


⸻

5. Counselling Pipeline Stages

Your ERP should show a pipeline board for counsellors.

Stages:

Consultation Done
Treatment Suggested
Cost Discussed
Thinking
Follow-up
Converted
Lost

Each patient moves through this pipeline.

⸻

6. Treatment Suggestion Structure

Counsellor can add:

services
packages
products

Example:

Concern: Acne scars

Suggested treatments:
Microneedling – 4 sessions
PRP add-on – 4 sessions
Homecare products

System creates:

treatment_plan


⸻

7. Cost Estimate / Proforma Invoice

Counsellor generates:

proforma invoice

Important rule:

Proforma ≠ Invoice

Proforma contains:

services
packages
products
discount
total cost

But:

no payment allowed


⸻

8. Patient Decision States

Patient can respond in 4 ways.

Accepted
Partial accepted
Thinking
Rejected


⸻

9. Full Conversion Flow

If patient accepts full plan.

System flow:

Proforma → Invoice
Invoice → Payment
Package → Activated
Treatment → Scheduled

System actions:

create invoice
activate package credits
add to patient treatment history


⸻

10. Partial Conversion Logic

Very common in clinics.

Example:

Doctor suggested:

PRP – 4 sessions
Laser – 6 sessions

Patient agrees only to:

PRP – 2 sessions

ERP should allow:

edit proforma
remove items
convert selected items

Result:

partial conversion

Pipeline status:

partially converted

Remaining treatments stay in pipeline.

⸻

11. Follow-up System

If patient does not convert immediately.

Counsellor schedules follow-ups.

Example follow-up timings:

3 days
7 days
15 days
30 days

Follow-up reminders:

WhatsApp
SMS
Task alerts

Example message:

Hi {{name}}, just checking if you had any questions about the treatment plan suggested by our doctor.


⸻

12. Counselling Notes

Counsellor must record:

patient concerns
budget
objections
timeline
decision stage

Example:

Patient concerned about cost
Prefers EMI option
Wants to start next month


⸻

13. Patient Profile Integration

In Patient Profile → Counselling Tab

Doctor and staff can see:

consultation notes
treatment plan
proforma estimates
conversion status
follow-ups

Timeline example:

Consultation done
Counselling completed
Treatment plan suggested
Proforma created
Follow-up scheduled
Converted


⸻

14. Doctor Visibility

Doctor should see counselling summary inside patient profile.

Example panel:

Counselling Summary

Suggested Treatments:
PRP – 4 sessions
Microneedling – 3 sessions

Status:
Patient thinking
Follow-up in 3 days

Doctor can:

edit treatment plan
add new treatments


⸻

15. Conversion → Treatment Flow

Once converted:

System creates:

active treatments
package credits
treatment sessions

Patient now moves to:

treatment module


⸻

16. Billing Integration

Important rule:

Counsellor cannot collect payment

Process:

Counsellor → creates proforma
Reception → converts to invoice
Reception → collects payment

Invoice linked to:

treatment plan
package
patient record


⸻

17. Counsellor Performance Dashboard

Your ERP should track:

Metrics:

leads handled
consultations done
conversion rate
revenue generated
follow-up efficiency

Example dashboard:

Consultations: 40
Converted: 18
Conversion rate: 45%
Revenue: ₹8,40,000


⸻

18. Counselling Data Tables

Database entities required:

counselling_records
treatment_plans
proforma_invoices
followup_tasks
conversion_logs


⸻

19. Important ERP Logic Rules

Your ERP must enforce these rules.

Counsellor cannot close invoice
Counsellor cannot collect payment
Doctor must approve treatment
Treatment cannot start without invoice
Package credits must exist before session


⸻

20. Real Patient Journey Example

Example real flow.

Patient books consultation
↓
Doctor consultation done
↓
Counsellor discussion
↓
Treatment plan created
↓
Proforma estimate shared
↓
Patient thinking
↓
Follow-up after 3 days
↓
Patient agrees
↓
Invoice generated
↓
Payment collected
↓
Package activated
↓
Treatment session scheduled

Everything stored in patient timeline.

⸻

Final System Design Principle

Your counselling module should behave like a sales CRM embedded inside ERP.

It connects:

CRM
↓
Consultation
↓
Counselling
↓
Billing
↓
Treatment


⸻

If you want, I can also show you one extremely powerful design improvement:

“Revenue Opportunity Engine”

This automatically shows clinics:

Patients who didn't convert
Patients with unused packages
Patients due for follow-up

This single feature can increase clinic revenue by 20-30% if implemented correctly.

For your ERP to support single clinics AND large clinic chains, the architecture must be multi-tenant with a hierarchy. Systems like Zenoti and Mangomint use a Chain → Clinic → Department → Staff structure.

Below is a complete practical flow for Chain Clinic Architecture, including creation, billing, management, and upgrades from single clinic to chain.

⸻

1. Core Hierarchy Structure

Your ERP must follow this hierarchy.

Platform (Your SaaS)
   ↓
Chain Organization
   ↓
Clinic Branch
   ↓
Departments
   ↓
Users / Staff

Example:

SkinCare Group (Chain)
   ↓
Delhi Clinic
Mumbai Clinic
Bangalore Clinic

Each clinic operates independently but reports to the chain HQ.

⸻

2. Database Architecture

Key tables:

organizations
clinics
users
roles
patients
appointments
invoices
inventory

Structure:

organization_id (Chain)
clinic_id (Branch)

Example:

organization_id = 1 (SkinCare Group)
clinic_id = 3 (Mumbai Branch)

Every record must contain:

organization_id
clinic_id

This allows:

• branch reports
• chain reports
• centralized control.

⸻

3. Chain Creation Flow

This happens at Super Admin Level (your platform).

Step 1 — Create Chain Organization

Fields:

organization_name
owner_name
email
phone
billing_plan
country
timezone

Example:

Organization: DermaGlow Clinics
Plan: Enterprise

System creates:

organization_id


⸻

Step 2 — Create First Clinic

Fields:

clinic_name
location
address
GST number
phone
timezone
currency

Example:

DermaGlow Delhi

System creates:

clinic_id
linked to organization_id


⸻

4. Clinic Creation Under Chain

Chain admin can add more clinics.

Example flow:

Chain Dashboard
→ Add New Clinic

Fields:

clinic name
city
address
manager
contact number
GST

System actions:

clinic created
branch database scope created
staff roles created
inventory initialized

Example chain:

DermaGlow Group

Clinic 1 – Delhi
Clinic 2 – Mumbai
Clinic 3 – Gurgaon
Clinic 4 – Bangalore


⸻

5. If Single Clinic Expands to Chain

This is very common.

Example:

Clinic A
opens new branch

Your ERP must support conversion from single clinic → chain.

Migration Logic

Step 1

create organization

Step 2

existing clinic becomes first branch

Step 3

add new clinics

Example:

Glow Skin Clinic
↓
Glow Skin Group

Existing data stays linked.

⸻

6. Chain Role Structure

Chain level roles:

Chain Owner
Chain Admin
Finance Head
Operations Manager

Clinic level roles:

Clinic Manager
Doctor
Counsellor
Therapist
Reception
Accountant

Permissions example:

Chain admin can:

view all clinics
view revenue
transfer inventory
create clinics

Clinic manager can:

manage only their clinic


⸻

7. Patient Sharing Across Clinics

Chain clinics often share patients.

Example:

Patient visits Delhi
later visits Mumbai branch

Your ERP must allow:

global patient profile

Patient table structure:

patient_id
organization_id
primary_clinic

Patient visits stored as:

visit_clinic_id


⸻

8. Package Sharing Across Clinics

Example:

Laser package purchased in Delhi
used in Mumbai

You must allow:

cross clinic redemption

Logic:

package belongs to organization
not just clinic

Option setting:

Allow cross branch usage = ON/OFF


⸻

9. Inventory Management in Chain

Two inventory types:

Clinic Inventory

local clinic stock

Central Inventory

warehouse

Example flow:

Central warehouse
↓
transfer stock
↓
clinic inventory

Inventory transfer record:

from_clinic
to_clinic
quantity
approval


⸻

10. Chain Level Reporting

Chain dashboard shows:

total revenue
clinic wise revenue
top services
conversion rates
doctor performance
inventory usage

Example report:

Delhi clinic revenue: ₹45L
Mumbai clinic revenue: ₹38L
Total chain revenue: ₹83L


⸻

11. Chain Billing (Your SaaS Revenue)

Your SaaS must bill chains properly.

Billing models:

Model 1

Per clinic subscription.

Example:

₹6000 / clinic / month

Chain with 5 clinics:

₹30,000 / month


⸻

Model 2

Enterprise chain pricing.

Example:

10 clinics
₹50,000 / month


⸻

Model 3

Base + branch pricing.

Example:

₹10,000 base
₹3000 per clinic


⸻

12. Chain Admin Control Panel

Chain admin dashboard should allow:

view all clinics
add clinic
edit clinic
disable clinic
transfer staff
transfer inventory
view consolidated reports


⸻

13. Editing Clinic Details

Chain admin can update:

clinic name
address
phone
GST
branding
working hours

Update reflects immediately.

⸻

14. Deleting Clinic

Deleting clinic should NOT remove records.

Instead:

clinic_status = inactive

Reason:

financial records must remain


⸻

15. Staff Management Across Clinics

Staff can belong to:

one clinic
multiple clinics

Example:

Doctor works in Delhi & Gurgaon

User record:

user_id
clinic_ids[]
role


⸻

16. Cross Clinic Appointment Booking

Patient booking logic:

select clinic
select doctor
select service

ERP shows available slots for selected branch.

⸻

17. Financial Accounting for Chains

Reports must show:

clinic revenue
chain revenue
wallet liability
membership liability

Example:

Delhi revenue ₹40L
Mumbai revenue ₹30L
Chain total ₹70L


⸻

18. Data Security

Each clinic should only see:

their clinic data

Except chain admin.

Use:

row level security
organization_id filter


⸻

19. Chain Dashboard

Main metrics:

total patients
appointments today
revenue today
conversion rate
clinic performance


⸻

20. Chain Setup Wizard (Best UX)

When chain signs up:

ERP should run:

Step 1
Create organization

Step 2
Create first clinic

Step 3
Add staff

Step 4
Add services

Step 5
Configure packages

Step 6
Go live


⸻

Final Architecture

Platform
↓
Organization (Chain)
↓
Clinic (Branch)
↓
Staff
↓
Patients
↓
Appointments
↓
Treatments
↓
Billing
↓
Reports


⸻

💡 My critical suggestion for your ERP

You should also build a Chain Control Center.

This screen shows:

all clinics
all revenue
all doctors
all inventory
all appointments

This feature is what makes systems like Zenoti extremely powerful for chains.

⸻

For your Dermatology & Aesthetic Clinic ERP, the billing architecture must support 3 core realities of clinics:
	1.	Services (Procedures / Treatments)
	2.	Packages (Bundled treatments)
	3.	Retail Products (Skincare / Cosmeceuticals)

Clinics also want category-wise revenue tracking because doctors often set monthly targets separately for Services vs Retail sales.

Below is a scalable billing architecture + workflow you can implement in your ERP.

⸻

1. Core Billing Categories (Revenue Buckets)

Every bill item must belong to a Revenue Category.

Category Structure

Revenue Category
   ├── Services
   │      ├── Laser Treatments
   │      ├── Injectables
   │      ├── Facials
   │      ├── Dermatology Procedures
   │
   ├── Packages
   │      ├── Laser Packages
   │      ├── Facial Packages
   │
   └── Retail Products
          ├── Skincare
          ├── Sunscreens
          ├── Serums
          ├── Post Treatment Kits

Every bill item must store:

Item ID
Item Type (Service / Package / Product)
Category
Subcategory
Doctor
Clinic
Price
Tax
Commission

This allows separate analytics dashboards.

⸻

2. Billing Flow (Clinic Front Desk)

Step 1 — Patient Visit Created

Patient arrives
↓
Visit created
↓
Doctor consultation
↓
Treatment / Product advised


⸻

Step 2 — Add Items to Bill

Billing screen should allow 3 sections

+ Add Service
+ Add Package
+ Add Product

Example bill:

Patient: Riya Sharma

Services
Hydrafacial             ₹4000

Packages
Laser Hair Removal 6 Sessions    ₹18000

Retail
Vitamin C Serum                ₹2200
Sunscreen SPF50                ₹1200

Total = ₹25,400

⸻

3. Package Billing Logic

Packages must behave differently from services.

Package Purchase

When patient buys a package:

Laser Hair Removal Package
6 sessions
Price ₹18000

ERP must create:

Package Wallet
Patient ID
Package Name
Total Sessions: 6
Remaining: 6
Expiry Date


⸻

Session Consumption

When treatment happens:

Select Package
↓
Consume 1 session
↓
Remaining sessions: 5

No billing again.

⸻

4. Retail Product Billing Logic

Retail must work like inventory POS.

When product billed:

Bill product
↓
Reduce inventory
↓
Calculate GST
↓
Add to retail revenue

Example:

Vitamin C Serum
MRP: 2200
GST: 18%
Stock reduced


⸻

5. Category-wise Target Tracking (Very Important)

Most aesthetic clinics track:

Monthly Service Target
Monthly Retail Target

Example:

Service Target = ₹15,00,000
Retail Target = ₹3,00,000


⸻

ERP Target Dashboard

Month: March

Services
Target: ₹15,00,000
Achieved: ₹11,40,000
Progress: 76%

Retail
Target: ₹3,00,000
Achieved: ₹1,90,000
Progress: 63%


⸻

6. Billing Database Logic

Billing Table

Bills
-----
Bill_ID
Patient_ID
Clinic_ID
Date
Total
Payment_Status
Created_By


⸻

Bill Items

Bill_Items
---------
Item_ID
Bill_ID
Item_Type
Item_Name
Category
Subcategory
Price
Quantity
Tax
Doctor_ID


⸻

Package Wallet

Patient_Packages
----------------
Package_ID
Patient_ID
Clinic_ID
Package_Name
Total_Sessions
Used_Sessions
Remaining_Sessions
Expiry_Date


⸻

Retail Inventory

Products
--------
Product_ID
Name
Category
MRP
Purchase_Price
Stock
GST


⸻

7. Revenue Reports (Category Based)

Your ERP should automatically generate:

Revenue by Category

Services Revenue
Packages Revenue
Retail Revenue


⸻

Doctor Revenue

Dr Mehta

Services
₹8,20,000

Retail
₹60,000

Packages Sold
₹3,50,000


⸻

Clinic Revenue

Clinic Gurgaon

Services  ₹12,40,000
Retail    ₹2,20,000
Packages  ₹4,80,000


⸻

8. Smart Billing Features (Premium Clinics Expect)

Partial Payments

Package Price ₹20,000

Paid Today ₹10,000
Remaining ₹10,000


⸻

Wallet / Advance

Patient deposits:

Advance ₹5000

Used later for services.

⸻

EMI Plans

Package ₹60,000

EMI Plan
₹20,000 x 3 months


⸻

9. Cross Clinic Billing (For Chains)

If patient bought package at:

Clinic A

They should be able to use it at:

Clinic B

ERP must check:

Is chain clinic?
Yes
Allow redemption


⸻

10. Real Clinic KPI Dashboard

Doctor owners want this dashboard daily.

Today Revenue

Services  ₹1,40,000
Retail    ₹28,000
Packages  ₹80,000

Total ₹2,48,000


⸻

11. Commission Logic (Very Important)

Doctors / therapists may get commission.

Example:

Hydrafacial

Doctor commission: 20%
Therapist commission: 10%

ERP calculates automatically.

⸻

12. Suggested Billing Screen UX

Patient Name
Visit Type

Add Service
Add Package
Add Product

--------------------------------

Services
Hydrafacial           ₹4000

Packages
Laser Hair Removal     ₹18000

Retail
Vitamin C Serum        ₹2200

--------------------------------

Total ₹24,200
Discount
Tax
Final Amount


⸻

13. Advanced Analytics Clinics Love

Your ERP can show:

Retail Conversion Rate

Patients seen: 120
Retail buyers: 40

Conversion = 33%


⸻

Average Billing

Total revenue ₹10,00,000
Patients 250

Avg bill = ₹4000


⸻

14. Future Premium Feature (Highly Valuable)

AI sales suggestion.

Example:

Patient bought Hydrafacial

ERP suggests

Vitamin C Serum
Sunscreen

This increases retail sales 20–30%.

⸻

15. Ideal Revenue Structure for Clinics

Most successful clinics follow:

70% Services
20% Packages
10% Retail

Your ERP dashboard should highlight this.

⸻

For your ERP, the CRM architecture must support two parallel teams working at the same time:

1️⃣ Calling / Lead Conversion Team (often centralized for chains)
2️⃣ Clinic Front Desk Team (handling existing patients & walk-ins)

If not designed properly, these teams fight over appointment slots, double-book doctors, or lose leads. Platforms like Zenoti and Clinicea solve this with a Lead Reservation + Smart Scheduling model.

Below is the complete CRM operational flow you should implement.

⸻

1. CRM Structure for Clinics & Chains

Your CRM should have 3 layers of lead handling.

Lead Source
↓
Calling Team CRM
↓
Appointment Booking Engine
↓
Clinic Appointment Calendar

Lead sources can be:
	•	Meta Ads
	•	Google Ads
	•	Website forms
	•	WhatsApp
	•	Phone calls
	•	Walk-ins

Each lead enters CRM first, not directly into appointment system.

⸻

2. Lead Capture Flow

When a lead is generated from ads:

Meta Ad → Webhook → CRM Lead Table

Lead record fields:

Lead ID
Name
Mobile
Source
Campaign
Location
Preferred clinic
Lead owner
Status

Status pipeline:

New Lead
↓
Contacted
↓
Interested
↓
Appointment Proposed
↓
Appointment Booked
↓
Visited
↓
Converted
↓
Lost


⸻

3. Calling Team Workflow

Calling team dashboard should show:

New Leads
Follow-up Leads
Appointment Booked
Lost Leads

When they open a lead:

1️⃣ Call the lead
2️⃣ Discuss treatment
3️⃣ Try to book consultation

⸻

4. Smart Appointment Booking for Calling Team

Calling team must not directly block doctor slots immediately.

Instead your system should use Slot Reservation Logic.

Step 1 — Search Slots

Calling team selects:

Clinic
Doctor
Service
Preferred Date

System checks real calendar.

⸻

Step 2 — Temporary Slot Hold

When calling team proposes a slot:

Slot reserved for 5 minutes

Status:

Pending Lead Booking

This prevents conflict with clinic staff.

⸻

5. Appointment Priority Logic

Your ERP should prioritize appointments like this:

1. Confirmed Appointments
2. Checked-in Patients
3. CRM Reserved Slots
4. Walk-in bookings

If clinic staff tries to book same slot:

System shows:

Slot temporarily reserved by CRM lead
Expires in 3 minutes


⸻

6. CRM Appointment Confirmation

Once lead confirms on call:

System converts reservation to:

Confirmed Appointment

Patient record created automatically.

Lead → Patient Conversion


⸻

7. If Lead Doesn’t Confirm

If call ends without confirmation:

Reservation automatically expires.

Slot released

Clinic staff can now book.

⸻

8. Clinic Staff Booking Logic

Reception dashboard shows:

Today's appointments
Walk-ins
Available slots
CRM bookings

When receptionist books appointment:

System checks:

Slot availability
Doctor availability
Room availability
Device availability


⸻

9. Walk-in Handling

Walk-in patient flow:

Reception
↓
Create patient
↓
Check available slot
↓
Book appointment

Walk-ins always override CRM reservations after expiry.

⸻

10. Chain Clinic Lead Routing

Chains often have central marketing team.

Lead routing rules should exist.

Example:

Lead location = Delhi
Assign to Delhi clinic

or

Lead source = Instagram
Assign to central calling team

Rules can include:

Location
Service interest
Doctor specialization
Clinic load


⸻

11. CRM Calendar Visibility

Calling team should see limited calendar view.

They see:

Available slots
Reserved slots
Confirmed slots

But they cannot see:

patient details
treatment notes
billing

This protects patient data.

⸻

12. Conflict Prevention Rules

Your ERP must enforce these rules:

No double booking for doctor
No double booking for device
No overlapping appointments

Slot types:

Available
Reserved
Confirmed
Checked-in
Completed


⸻

13. Lead Follow-up System

If lead doesn’t book immediately:

System creates follow-ups.

Example schedule:

Day 1 – Call
Day 3 – WhatsApp message
Day 7 – Second call
Day 14 – Offer reminder

Calling team dashboard:

Follow-up tasks
Leads due today
Hot leads
Cold leads


⸻

14. Lead to Patient Conversion

When appointment is booked:

System does:

Create patient profile
Link lead ID
Track campaign ROI

Patient timeline shows:

Lead created
Appointment booked
Consultation done
Treatment purchased


⸻

15. CRM Analytics (Important for Chains)

Your ERP should track:

Lead Source Performance

Meta Ads – 300 leads
Google Ads – 120 leads
Website – 40 leads

Conversion Rate

Meta Ads
Leads: 300
Appointments: 120
Converted: 45

Calling Team Performance

Agent Rahul
Calls made: 200
Appointments booked: 65
Conversion rate: 32%


⸻

16. Doctor Calendar Protection

Some clinics want slots reserved only for existing patients.

Example:

Doctor availability
10 slots daily

6 slots – CRM leads
4 slots – existing patients

This prevents CRM overload.

⸻

17. Appointment Buffer Logic

Example:

Consultation time: 20 minutes
Buffer: 5 minutes

System automatically spaces appointments.

⸻

18. Advanced CRM Feature (Very Powerful)

Lead Scoring System

ERP ranks leads automatically.

Example scoring:

Filled form: +10
Responded to call: +20
Clicked WhatsApp: +10
Requested price: +30

Hot leads appear first for calling team.

⸻

19. Ideal CRM Dashboard

Calling team sees:

New Leads
Hot Leads
Follow-ups Today
Appointments Booked
Conversion Rate

Clinic dashboard shows:

Appointments Today
Walk-ins
Lead Appointments
Doctor Schedule


⸻

20. Complete CRM → Clinic Flow

Final architecture:

Ads
↓
CRM Lead Capture
↓
Calling Team Contact
↓
Slot Reservation
↓
Appointment Confirmation
↓
Clinic Calendar
↓
Patient Visit
↓
Consultation
↓
Treatment Plan
↓
Conversion


⸻

My Critical Recommendation for Your ERP

You should also build Lead Ownership Rules.

Example:

Lead assigned to Rahul
Only Rahul can book appointment for 2 hours
After 2 hours → lead reassigned

This prevents lead conflicts in large calling teams.

⸻

Designing the Patient Profile Screen correctly is one of the most important parts of your clinic ERP. Systems like Zenoti, Clinicea, and Mindbody treat the patient profile as the central hub of the entire system.

Everything (appointments, billing, packages, treatments, CRM history) should connect to this one screen.

I’ll design the ideal patient profile architecture for dermatology & aesthetic clinics.

⸻

1. New Patient Creation Flow

There should be 3 ways to create a patient.

1️⃣ Quick Add (Front Desk)

Fast creation when patient walks in.

Required fields:

Name
Mobile number
Gender
Age / DOB

Optional but recommended:

Email
City
Lead Source
Referring doctor

System then generates:

Patient ID

Example:

EK-DEL-000245


⸻

2️⃣ From CRM Lead Conversion

When a lead books appointment:

Lead → Convert to Patient

System auto fills:

Name
Phone
Email
Lead source
Campaign


⸻

3️⃣ Online Booking

Website or WhatsApp booking creates patient automatically.

⸻

2. Patient Profile Layout (Master Screen)

Patient profile should have 3 areas.

HEADER
QUICK ACTION BAR
DETAIL TABS


⸻

3. Patient Header (Top Section)

This should always stay visible.

Example:

Patient Photo
Name
Patient ID
Age / Gender
Mobile
Email
Total Visits
Last Visit Date
Outstanding Balance
Loyalty Points

Also show:

Allergy Alert
Medical Alert
VIP Tag
Membership Tag

Example:

⚠ Isotretinoin user
⚠ Laser contraindication


⸻

4. Quick Action Bar (Very Important)

This is the power navigation section.

One-click access to important actions.

Example buttons:

+ Appointment
+ Billing
+ Treatment
+ Package
+ Retail Sale
+ Upload Photo
+ Add Note
+ Send WhatsApp

Secondary actions:

Create Prescription
Start Consultation
Add Consent
Add Before/After Photo
Create Follow-up

This lets staff jump instantly without leaving patient screen.

⸻

5. Smart Navigation Logic

When user clicks an action:

Example:

Patient Profile
↓
Click "Billing"
↓
Billing Screen Opens
↓
Auto-linked Patient

Top breadcrumb:

Patients > Shreya Gupta > Billing

Buttons:

Save & Return
Save & Close

This takes user back to patient profile instantly.

⸻

6. Patient Profile Tabs

Main content of patient profile.

Recommended tabs:

Overview
Appointments
Medical History
Treatments
Packages
Billing & Payments
Retail Purchases
Photos
Consents
Prescriptions
Notes
Documents
Loyalty & Membership
Communication


⸻

7. Overview Tab (Summary Dashboard)

Shows complete patient summary.

Example:

Total Visits
Total Revenue Generated
Active Packages
Pending Payments
Upcoming Appointments
Last Treatment

Also show:

Before / After photos
Current treatment plan

Example:

Laser Hair Removal – Session 3/8
Hydrafacial – 2 remaining


⸻

8. Appointments Tab

Shows full appointment history.

Columns:

Date
Doctor
Service
Status
Clinic location
Notes

Statuses:

Booked
Checked-in
Completed
Cancelled
No-show

Also allow:

Reschedule
Cancel
Book again


⸻

9. Medical History Tab

Important for dermatology.

Fields:

Skin type
Allergies
Medical conditions
Current medications
Pregnancy status
Photosensitivity history

Also include:

Past treatments
Laser contraindications


⸻

10. Treatments Tab

Shows procedures done.

Example table:

Date
Treatment
Doctor
Area
Energy settings
Device used
Notes

Example:

Laser Hair Removal
Device: Primelaze
Energy: 16J
Pulse width: 30ms

Reference device like Primelase Laser if clinics use it.

⸻

11. Packages Tab

Shows purchased packages.

Example:

Hydrafacial Package
Total sessions: 6
Used: 3
Remaining: 3
Expiry: Dec 2026

Actions:

Redeem session
Transfer package
Freeze package


⸻

12. Billing & Payments Tab

Financial history.

Example table:

Invoice ID
Date
Services
Amount
Paid
Balance
Payment method

Actions:

View invoice
Send invoice
Refund
Add payment


⸻

13. Retail Purchases Tab

Products purchased.

Example:

Date
Product
Brand
Quantity
Amount

Example product brands like:
	•	SkinCeuticals
	•	Obagi Medical

⸻

14. Photos Tab

Critical for aesthetic clinics.

Types:

Before photos
After photos
Progress photos

Features:

Side-by-side comparison
Timeline slider
AI skin analysis (future)


⸻

15. Consents Tab

Store treatment consent forms.

Examples:

Laser consent
PRP consent
Botox consent

Patient can sign via:

iPad
Digital signature


⸻

16. Prescriptions Tab

Doctor prescriptions.

Example:

Medication
Dose
Duration
Instructions

Example medication like:

Isotretinoin.

⸻

17. Notes Tab

Internal staff notes.

Example:

Sensitive skin
Prefers female therapist
Concerned about pigmentation

Notes types:

Doctor notes
Reception notes
Therapist notes


⸻

18. Documents Tab

Upload files:

Lab reports
Consent scans
Referral letters
ID proof


⸻

19. Loyalty & Membership Tab

Track patient benefits.

Example:

Loyalty points: 540
Membership tier: Gold
Discount eligibility


⸻

20. Communication Tab

Shows patient communication history.

Example:

WhatsApp messages
SMS reminders
Email invoices
Campaign messages


⸻

21. Patient Timeline (Very Powerful Feature)

Instead of opening multiple tabs, show timeline view.

Example:

2026 Feb 20
Consultation – Dr Sharma

2026 Feb 20
Hydrafacial session

2026 Feb 20
Invoice generated ₹8500

2026 Feb 25
Follow-up message sent


⸻

22. Floating Quick Panel

Right side floating panel:

Upcoming appointment
Active package
Outstanding balance
Recent treatment


⸻

23. Patient Tags

Clinics love tagging patients.

Example:

VIP
Influencer
Employee
Staff family
High spender


⸻

24. Smart Alerts

When patient profile opens show alerts:

⚠ Active acne medication
⚠ Package expiring in 7 days
⚠ Pending payment ₹2500


⸻

25. Ideal Patient Profile Screen Layout

HEADER
Patient Info

QUICK ACTION BAR
Appointments | Billing | Packages | Treatment

LEFT SIDE
Tabs

RIGHT SIDE
Timeline + Alerts


⸻

26. Power Feature (Used by Big Chains)

Patient Lifetime Value (LTV)

Example:

Total revenue generated
₹2,35,000

Clinics love this metric.

⸻

My Suggestion for Your ERP

You should also build a Global Search Bar.

Staff can search:

Name
Phone
Patient ID
Invoice
Package

Search opens patient profile instantly.

⸻

The Appointment Screen is the heart of clinic operations. Every department interacts with it — reception, doctors, therapists, CRM team, and management. Systems like Zenoti and Mindbody are built around a smart calendar architecture, and you should design something similar but optimized for dermatology & aesthetic clinics.

Below is a complete appointment screen blueprint for your ERP.

⸻

1. Appointment Screen Structure

The appointment module should have 4 main sections.

LEFT PANEL → Filters & Doctor List
CENTER → Calendar Schedule
RIGHT PANEL → Appointment Details
TOP BAR → Actions & Search

This layout lets staff view, create, edit, and manage bookings quickly.

⸻

2. Top Bar (Control Panel)

This area controls the entire calendar.

Elements:

Search Patient
Date Selector
Clinic Location
View Mode
New Appointment Button
Quick Filters

Example:

[ Search Patient ]  [ Today ]  [ Location: GK Clinic ]
[ Doctor View | Room View | Device View ]
+ New Appointment

View types:

Doctor View
Therapist View
Room View
Device View

Device view is important for laser machines like Primelase Laser or other equipment.

⸻

3. Left Panel (Resource List)

Shows available resources.

Example:

Doctors
Therapists
Rooms
Devices

Doctor example:

Dr. Sharma
Dr. Mehta
Dr. Kaur

Each resource shows:

Available hours
Breaks
Appointments count

Color indicators:

Green = Available
Red = Fully booked
Yellow = Limited slots


⸻

4. Center Panel (Main Calendar Grid)

This is the visual appointment board.

Structure:

Vertical → Time slots
Horizontal → Doctors

Example:

          Dr Sharma | Dr Mehta | Dr Kaur
10:00     Free       Free       Booked
10:30     Booked     Free       Free
11:00     Free       Booked     Free

Each block shows:

Patient Name
Service
Duration
Status

Example:

Riya Singh
Hydrafacial
30 min


⸻

5. Appointment Status Colors

Color coding makes calendar readable.

Example:

Blue → Booked
Green → Checked-in
Purple → Treatment in progress
Grey → Completed
Red → Cancelled
Orange → CRM lead reservation

This helps reception scan schedule instantly.

⸻

6. Right Panel (Appointment Details)

When staff clicks an appointment block, the side panel opens.

Details shown:

Patient Name
Phone
Service
Doctor
Room
Device
Duration
Notes
Package usage

Actions:

Check-in
Reschedule
Cancel
Start treatment
Add billing


⸻

7. New Appointment Creation Flow

Click + New Appointment.

Step-by-step form:

Step 1 — Select Patient

Search:

Name
Mobile
Patient ID

Or create new patient.

⸻

Step 2 — Select Service

Example:

Consultation
Laser Hair Removal
Hydrafacial
Chemical Peel


⸻

Step 3 — Assign Resource

Choose:

Doctor
Therapist
Room
Device

System checks availability.

⸻

Step 4 — Select Time

Calendar shows available slots.

Example:

10:30
11:00
11:30


⸻

Step 5 — Confirm Appointment

Optional:

Add notes
Send confirmation
Add package session

Then:

Save Appointment


⸻

8. Smart Duration Logic

Each service should have predefined duration.

Example:

Consultation → 15 min
Hydrafacial → 45 min
Laser Hair Removal → 30 min

System automatically blocks time.

⸻

9. Multi-Service Appointment

Sometimes patients do multiple services.

Example:

Consultation
Hydrafacial
Laser

System creates combined timeline.

10:00 Consultation
10:15 Hydrafacial
11:00 Laser


⸻

10. Package Session Booking

If patient has package:

Example:

Laser Hair Removal Package
Remaining sessions: 4

Appointment automatically deducts 1 session.

⸻

11. Appointment Check-in Workflow

Reception workflow:

Patient arrives
↓
Click appointment
↓
Check-in

Status becomes:

Checked-in

Patient moves to doctor queue.

⸻

12. Doctor Queue Screen

Doctor dashboard shows:

Checked-in patients
Waiting patients
In treatment

Example:

1. Riya Singh
Consultation

2. Neha Gupta
Acne treatment


⸻

13. Treatment Start

Doctor or therapist clicks:

Start Treatment

Status becomes:

In Progress


⸻

14. Appointment Completion

After treatment:

Complete Appointment

Next actions appear:

Generate bill
Schedule follow-up
Add notes
Upload photos


⸻

15. Reschedule Logic

When rescheduling:

System shows available slots.

Old slot:

Released

New slot:

Booked

History saved.

⸻

16. Cancellation Logic

Cancellation reasons:

Patient cancelled
Doctor unavailable
No-show
Clinic cancelled

This helps analytics.

⸻

17. No-show Tracking

If patient doesn’t arrive:

Mark No-show

CRM can send:

Follow-up message


⸻

18. Waitlist System

If slots are full:

Patient can join waitlist.

Example:

Hydrafacial waitlist

If cancellation occurs:

Notify waitlist patient


⸻

19. Walk-in Appointment

Walk-in flow:

Reception → Add patient → Book slot

If no slot available:

Add between slots

System creates overbook alert.

⸻

20. Doctor Block Time

Doctors can block time.

Example:

Lunch break
Meeting
Surgery
Leave

Calendar shows blocked slots.

⸻

21. Device & Room Locking

For laser procedures:

System reserves:

Doctor
Room
Device

This avoids equipment conflict.

⸻

22. Appointment Notifications

System automatically sends:

Booking confirmation
24 hr reminder
2 hr reminder

Via:

SMS
WhatsApp
Email


⸻

23. Appointment Filters

Staff can filter calendar.

Example:

Doctor
Service
Status
Lead source

Example:

Show only consultation appointments


⸻

24. Drag & Drop Feature

Staff can drag appointment blocks.

Example:

Drag 10:30 appointment → 11:00 slot

System updates instantly.

⸻

25. Appointment Analytics

Managers should see:

Appointments booked
Appointments completed
No-show rate
Doctor utilization

Example:

Dr Sharma
Appointments: 25
Completed: 22
No-show: 3


⸻

26. Ideal Appointment Screen Layout

TOP
Search | Date | Location | View

LEFT
Doctor / Resource list

CENTER
Calendar grid

RIGHT
Appointment detail panel


⸻

27. Power Feature (Big Clinics Use)

Smart Slot Optimization

System suggests best slots.

Example:

Suggest 11:00 instead of 10:45
to avoid gap

This increases doctor utilization.

⸻

28. Appointment Heatmap

Managers see busy hours.

Example:

10–12 → Full
2–4 → Low traffic

Helps marketing campaigns.

⸻

Your idea is actually the correct modern UX approach. Instead of a “Who did this?” button, good ERPs show metadata directly inside every record. This is cleaner, faster, and avoids extra clicks.

Systems like Zenoti and Mindbody follow this principle:
Every object (appointment, invoice, patient, package, etc.) carries its own activity metadata.

Below is the best architecture for implementing this in your ERP.

⸻

1. Universal Metadata System (For Every Record)

Every important record in your ERP should automatically store 4 metadata fields.

Created By
Created At
Last Updated By
Last Updated At

Optional but recommended:

Confirmed By
Completed By
Cancelled By

These fields should be visible in the UI whenever the record is opened.

⸻

2. Appointment Record Example

When someone clicks an appointment block on the calendar, the right panel opens.

Example:

Appointment Details

Patient: Riya Singh
Service: Hydrafacial
Doctor: Dr Sharma
Date: 20 Feb 2026
Time: 11:00 – 11:45

Created By: Rahul (CRM Team)
Created At: 19 Feb 2026 – 4:12 PM

Confirmed By: Neha (Reception)
Confirmed At: 20 Feb 2026 – 9:05 AM

Checked-in By: Pooja
Checked-in At: 10:58 AM

Completed By: Therapist Anjali
Completed At: 11:46 AM

So every stage shows the responsible staff.

⸻

3. Invoice Screen Example

When invoice is opened:

Invoice #INV-00452

Patient: Riya Singh
Services:
Hydrafacial – ₹6500
Serum – ₹2000

Total: ₹8500
Paid: ₹8500
Payment Method: UPI

Metadata section (bottom):

Created By: Neha (Reception)
Created At: 20 Feb – 11:50 AM

Discount Approved By: Clinic Manager
Discount: ₹1000

Payment Received By: Neha


⸻

4. Patient Profile Example

Inside patient profile header:

Patient: Riya Singh
Patient ID: EK-000245

Created By: Neha
Created On: 15 Feb 2026
Last Updated By: Dr Sharma
Last Updated: 20 Feb 2026


⸻

5. Consultation Screen Example

Consultation panel should show:

Consultation Details

Doctor: Dr Sharma
Start Time: 11:00 AM
End Time: 11:15 AM

Consultation Created By: Neha
Consultation Conducted By: Dr Sharma
Prescription Generated By: Dr Sharma


⸻

6. Package Record Example

When package is opened:

Package: Laser Hair Removal

Sessions: 8
Used: 3
Remaining: 5
Expiry: Dec 2026

Metadata:

Sold By: Neha
Sold On: 10 Feb 2026

Session 1 Used By: Therapist Anjali
Session 2 Used By: Therapist Anjali
Session 3 Used By: Therapist Ritu


⸻

7. Retail Product Sale Example

Example product brand:

SkinCeuticals

Invoice item details:

Product: SkinCeuticals Vitamin C Serum
Price: ₹7500
Quantity: 1

Metadata:

Sold By: Neha
Stock Deducted By: System
Payment Collected By: Neha


⸻

8. Appointment Card Preview

When hovering or clicking appointment:

Riya Singh
Hydrafacial
11:00 – 11:45

Created by Rahul
Confirmed by Neha

This gives quick clarity without opening full details.

⸻

9. Activity Timeline Panel (Optional but Powerful)

Every record should still have timeline view.

Example in appointment:

Activity

19 Feb – 4:12 PM
Appointment created by Rahul

20 Feb – 9:05 AM
Confirmed by Neha

20 Feb – 10:58 AM
Checked-in by Pooja

20 Feb – 11:46 AM
Treatment completed by Anjali


⸻

10. Visual UI Placement

Best placement of metadata is bottom right of record.

Example layout:

---------------------------------
Appointment Details

Patient Info
Service Info
Doctor Info
Notes
---------------------------------

Created By: Rahul
Created At: 19 Feb 4:12 PM
Last Updated: 20 Feb 9:05 AM
---------------------------------

This keeps UI clean.

⸻

11. Color Tagging for Roles

Staff roles should show visually.

Example:

Rahul – CRM Team
Neha – Reception
Dr Sharma – Doctor
Anjali – Therapist

This helps chains understand which department handled the patient.

⸻

12. System Actions vs Human Actions

ERP should distinguish between system actions and staff actions.

Example:

Package Session Deducted: System

vs

Package Session Redeemed By: Anjali


⸻

13. Record Locking Info

When a record is open:

Editing by: Neha

Prevents conflicts.

⸻

14. Audit Integrity Rule (Very Important)

These fields must be non-editable.

Example:

Created By
Created At

cannot be changed manually.

⸻

15. Database Implementation

Every table should include these fields:

created_by
created_at
updated_by
updated_at
clinic_id

Optional fields:

confirmed_by
cancelled_by
completed_by


⸻

16. Example Full Lifecycle

Example for one appointment:

19 Feb
Appointment created by Rahul (CRM)

20 Feb
Confirmed by Neha (Reception)

20 Feb
Patient checked-in by Pooja

20 Feb
Consultation done by Dr Sharma

20 Feb
Hydrafacial performed by Anjali

20 Feb
Invoice created by Neha

Everything visible inside each record.

⸻

17. Why Clinic Owners Love This

It helps them instantly answer:

Who booked this patient?
Who gave discount?
Who completed treatment?
Who handled payment?

This prevents staff disputes and revenue leakage.

⸻

✅ My strong recommendation for your ERP

Add a small “Info Icon (ⓘ)” next to every record title.

When clicked, it shows full metadata:

Created by
Modified by
All activity logs

This keeps UI clean but transparent.

⸻

The Patient Journey Tracker is a very powerful feature for your ERP because clinic owners want to see how a lead converts into revenue. Very few clinic softwares visualize this properly. Platforms like Zenoti track the journey internally but rarely show it clearly to staff.

You can design a visual patient journey system that connects CRM → Appointment → Consultation → Treatment → Billing → Follow-ups.

⸻

1. Core Idea of Patient Journey Tracker

Every patient should have a timeline flow showing the entire lifecycle.

Example journey:

Lead Created
↓
Lead Contacted
↓
Appointment Booked
↓
Consultation Done
↓
Treatment Recommended
↓
Package / Service Purchased
↓
Treatment Sessions
↓
Follow-up

This becomes the complete patient journey map.

⸻

2. Where This Should Appear in ERP

The Patient Journey Tracker should appear in two places.

1️⃣ Patient Profile

Top section showing the patient’s lifecycle.

2️⃣ CRM Dashboard

Showing lead conversion status.

⸻

3. Patient Journey Visual Layout

A horizontal step tracker works best.

Example:

Lead → Appointment → Consultation → Treatment → Billing → Follow-up

Each step shows:

Status
Responsible staff
Date & time

Example:

Lead Created
Source: Instagram Ads
By: Rahul (CRM)

Appointment Booked
By: Neha (Reception)

Consultation Done
By: Dr Sharma

Treatment Purchased
By: Neha

Treatment Session
By: Therapist Anjali


⸻

4. Patient Journey Status Colors

Each stage should have a color.

Grey → Not started
Blue → Scheduled
Green → Completed
Red → Cancelled
Orange → Pending action

This makes the journey very easy to understand visually.

⸻

5. Lead Stage Details

When a patient originates from marketing.

Example:

Lead Source: Meta Ads
Campaign: Acne Treatment Campaign
Captured On: 18 Feb
Assigned To: Rahul


⸻

6. Appointment Stage

Shows:

Appointment Date
Doctor
Service
Created By
Confirmed By

Example:

20 Feb
Consultation with Dr Sharma
Created by Rahul
Confirmed by Neha


⸻

7. Consultation Stage

Important for aesthetic clinics.

Example:

Consultation Completed
Doctor: Dr Sharma
Diagnosis: Acne Scarring
Recommended Treatment: Microneedling + PRP

Example procedure using platelet therapy like Platelet-Rich Plasma Therapy.

⸻

8. Treatment Recommendation Stage

Doctor creates treatment plan.

Example:

Treatment Plan

Microneedling – 4 sessions
PRP – 4 sessions
Estimated cost: ₹40,000

Also track:

Counselling Done By

Example:

Counselling by Clinic Coordinator


⸻

9. Billing / Purchase Stage

Shows when patient converts.

Example:

Package Purchased
Microneedling Package
₹36,000
Sold by Neha


⸻

10. Treatment Session Tracking

Each session appears as a sub-stage.

Example:

Session 1 – Completed
Session 2 – Completed
Session 3 – Scheduled
Session 4 – Pending

Shows therapist:

Session 1 done by Anjali


⸻

11. Follow-up Stage

Clinics want automated follow-ups.

Example:

Follow-up scheduled
Date: 15 March
Message sent: WhatsApp reminder


⸻

12. Visual Timeline Example

Example patient journey:

18 Feb
Lead captured (Meta Ads)

19 Feb
Lead contacted by Rahul

20 Feb
Appointment booked

20 Feb
Consultation done by Dr Sharma

20 Feb
Treatment package purchased ₹36,000

25 Feb
Session 1 completed

10 Mar
Session 2 scheduled

This is extremely powerful for clinic analysis.

⸻

13. Journey Alerts

System should show alerts if journey stalls.

Example:

Lead contacted but no appointment booked after 3 days

or

Consultation done but no treatment purchased

This helps CRM teams recover revenue.

⸻

14. Lead Conversion Metrics

Managers should see journey conversion stats.

Example:

Leads Generated: 500
Appointments Booked: 210
Consultations Done: 170
Treatments Purchased: 75

Conversion funnel becomes clear.

⸻

15. Revenue Attribution

Journey tracker should show which campaign generated revenue.

Example:

Campaign: Acne Instagram Campaign

Leads: 120
Revenue Generated: ₹9,50,000


⸻

16. Staff Contribution Tracking

Each stage shows who handled the patient.

Example:

Lead handled by Rahul
Appointment by Neha
Consultation by Dr Sharma
Treatment by Anjali
Billing by Neha

This also helps with incentive calculations.

⸻

17. Patient Drop-Off Detection

ERP should detect drop-off stages.

Example:

Consultation done but no treatment purchased

System can trigger:

Follow-up task
Offer message
Call reminder


⸻

18. Multi-Clinic Journey Tracking

If patient visits multiple branches:

Example:

Consultation – GK Clinic
Treatment – South Delhi Clinic
Follow-up – Gurgaon Clinic

ERP must track journey across clinics.

⸻

19. Owner Dashboard Version

Clinic owner should see aggregate journey funnel.

Example:

Lead → Appointment → Consultation → Purchase

1000 leads
420 appointments
310 consultations
120 purchases

This becomes marketing ROI measurement.

⸻

20. Ideal Patient Journey UI

Layout:

Top
Patient Journey Progress Bar

Middle
Detailed timeline

Right
Staff responsible + revenue generated

This turns the patient profile into a complete story of the patient.

⸻

✅ My recommendation for your ERP

Combine Patient Journey + Timeline + Activity Log into one unified system.
This becomes a major selling feature for clinic chains.

⸻
