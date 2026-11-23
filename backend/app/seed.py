import logging, calendar
from pathlib import Path
from datetime import datetime
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from .models import (
    Room, Bed, Tenant, BedAllocation, RentInvoice, Payment, Deposit, DepositTransaction,
    Expense, Receipt, FinancialAuditLog,
    FoodPlan, FoodSubscription, MealRecord,
    WifiService, WifiSubscription,
    ParkingSlot, ParkingAllocation,
    AcSubscription,
    ElectricityMeter, ElectricityReading,
    ServiceCatalog, TenantServiceSubscription,
    ServiceCharge, ServiceAuditLog
)
from .receipt_generator import generate_pdf_receipt

logger = logging.getLogger("moonlight.seed")
SEED_MARKER = Path(__file__).resolve().parent.parent / "data" / ".seeded"

def seed_initial_data(db: Session):
    if SEED_MARKER.exists():
        return
    existing_rooms = db.scalar(select(func.count(Room.id))) or 0
    if existing_rooms == 0:
        logger.info("Initializing Moon Light PG default baseline data (15 rooms, 30 beds, 8 tenants)...")
        
        # 1. Create 15 rooms across 3 floors
        rooms_data = [
            # Floor 1
            {"number": "101", "floor": 1, "rent": 6500.0, "type": "Sharing", "desc": "Ground floor double sharing room"},
            {"number": "102", "floor": 1, "rent": 6500.0, "type": "Sharing", "desc": "Ground floor double sharing room"},
            {"number": "103", "floor": 1, "rent": 6500.0, "type": "Sharing", "desc": "Ground floor double sharing room with balcony"},
            {"number": "104", "floor": 1, "rent": 6500.0, "type": "Sharing", "desc": "Ground floor double sharing room"},
            {"number": "105", "floor": 1, "rent": 6500.0, "type": "Sharing", "desc": "Ground floor double sharing room"},
            # Floor 2
            {"number": "201", "floor": 2, "rent": 6000.0, "type": "Sharing", "desc": "First floor double sharing room"},
            {"number": "202", "floor": 2, "rent": 6000.0, "type": "Sharing", "desc": "First floor double sharing room"},
            {"number": "203", "floor": 2, "rent": 6000.0, "type": "Sharing", "desc": "First floor double sharing room with balcony"},
            {"number": "204", "floor": 2, "rent": 6000.0, "type": "Sharing", "desc": "First floor double sharing room"},
            {"number": "205", "floor": 2, "rent": 6000.0, "type": "Sharing", "desc": "First floor double sharing room"},
            # Floor 3
            {"number": "301", "floor": 3, "rent": 5500.0, "type": "Sharing", "desc": "Second floor double sharing room"},
            {"number": "302", "floor": 3, "rent": 5500.0, "type": "Sharing", "desc": "Second floor double sharing room"},
            {"number": "303", "floor": 3, "rent": 5500.0, "type": "Sharing", "desc": "Second floor double sharing room"},
            {"number": "304", "floor": 3, "rent": 5500.0, "type": "Sharing", "desc": "Second floor double sharing room with terrace view"},
            {"number": "305", "floor": 3, "rent": 5500.0, "type": "Sharing", "desc": "Second floor double sharing room"},
        ]

        created_rooms = []
        created_beds = []

        for rdata in rooms_data:
            room = Room(
                room_number=rdata["number"],
                floor=rdata["floor"],
                room_type=rdata["type"],
                capacity=2,
                monthly_rent=rdata["rent"],
                status="Available",
                description=rdata["desc"]
            )
            db.add(room)
            db.flush()
            created_rooms.append(room)

            for bnum in [1, 2]:
                bed = Bed(
                    room_id=room.id,
                    bed_number=f"Bed {bnum}",
                    status="Available",
                    monthly_rent=rdata["rent"]
                )
                db.add(bed)
                db.flush()
                created_beds.append(bed)

        # 2. Create 8 initial tenants
        initial_tenants = [
            {"code": "TEN-0001", "name": "Rahul Sharma", "mobile": "9876543210", "email": "rahul.s@example.com", "gender": "Male", "dob": "1998-05-14", "address": "Flat 402, Green Valley, Pune", "em_name": "Ramesh Sharma", "em_phone": "9876543219", "occ": "Working", "org": "Infosys", "join": "2026-01-10", "bed_idx": 0},
            {"code": "TEN-0002", "name": "Amit Verma", "mobile": "9876543211", "email": "amit.v@example.com", "gender": "Male", "dob": "1999-08-21", "address": "12, Lake View Road, Bhopal", "em_name": "Suresh Verma", "em_phone": "9876543218", "occ": "Working", "org": "TCS", "join": "2026-01-15", "bed_idx": 1},
            {"code": "TEN-0003", "name": "Rohan Patel", "mobile": "9876543212", "email": "rohan.p@example.com", "gender": "Male", "dob": "2001-03-11", "address": "B-304, Shanti Nagar, Ahmedabad", "em_name": "Kirit Patel", "em_phone": "9876543217", "occ": "Student", "org": "Engineering College", "join": "2026-02-01", "bed_idx": 2},
            {"code": "TEN-0004", "name": "Priya Nair", "mobile": "9876543213", "email": "priya.n@example.com", "gender": "Female", "dob": "1997-11-29", "address": "TC 14/200, Palayam, Trivandrum", "em_name": "Radha Nair", "em_phone": "9876543216", "occ": "Working", "org": "Wipro", "join": "2026-02-05", "bed_idx": 3},
            {"code": "TEN-0005", "name": "Vikram Singh", "mobile": "9876543214", "email": "vikram.s@example.com", "gender": "Male", "dob": "1996-07-19", "address": "Sector 14, Chandigarh", "em_name": "Baldev Singh", "em_phone": "9876543215", "occ": "Working", "org": "Cognizant", "join": "2026-02-10", "bed_idx": 4},
            {"code": "TEN-0006", "name": "Sneha Kulkarni", "mobile": "9876543215", "email": "sneha.k@example.com", "gender": "Female", "dob": "2000-02-14", "address": "Shivaji Nagar, Nashik", "em_name": "Anil Kulkarni", "em_phone": "9876543214", "occ": "Student", "org": "Medical University", "join": "2026-02-15", "bed_idx": 5},
            {"code": "TEN-0007", "name": "Arjun Reddy", "mobile": "9876543216", "email": "arjun.r@example.com", "gender": "Male", "dob": "1998-09-03", "address": "Madhapur, Hyderabad", "em_name": "Prasad Reddy", "em_phone": "9876543213", "occ": "Working", "org": "HCL Tech", "join": "2026-03-01", "bed_idx": 6},
            {"code": "TEN-0008", "name": "Karthik Iyer", "mobile": "9876543217", "email": "karthik.i@example.com", "gender": "Male", "dob": "1999-12-08", "address": "Mylapore, Chennai", "em_name": "Subramanian Iyer", "em_phone": "9876543212", "occ": "Working", "org": "Accenture", "join": "2026-03-05", "bed_idx": 7},
        ]

        for tdata in initial_tenants:
            tenant = Tenant(
                tenant_code=tdata["code"],
                full_name=tdata["name"],
                mobile=tdata["mobile"],
                email=tdata["email"],
                gender=tdata["gender"],
                dob=tdata["dob"],
                permanent_address=tdata["address"],
                emergency_contact_name=tdata["em_name"],
                emergency_contact_number=tdata["em_phone"],
                occupation=tdata["occ"],
                company_or_college=tdata["org"],
                joining_date=tdata["join"],
                status="Active"
            )
            db.add(tenant)
            db.flush()

            bed = created_beds[tdata["bed_idx"]]
            bed.status = "Occupied"

            allocation = BedAllocation(
                tenant_id=tenant.id,
                bed_id=bed.id,
                room_id=bed.room_id,
                allocation_date=tdata["join"],
                monthly_rent=bed.monthly_rent,
                is_active=True
            )
            db.add(allocation)

        # 3. Update room occupancy statuses
        for room in created_rooms:
            beds_in_room = [b for b in created_beds if b.room_id == room.id]
            occ = sum(1 for b in beds_in_room if b.status == "Occupied")
            if occ == len(beds_in_room):
                room.status = "Full"
            elif occ > 0:
                room.status = "Partially Occupied"
            else:
                room.status = "Available"

        db.commit()

    # PHASE 3: Seed initial financial data if invoices table is empty
    existing_invoices = db.scalar(select(func.count(RentInvoice.id))) or 0
    if existing_invoices == 0:
        logger.info("Initializing Phase 3 financial seed data (Rent Invoices, Deposits, Payments, Expenses)...")
        now = datetime.now()
        month = now.month
        year = now.year

        active_allocs = db.scalars(
            select(BedAllocation).where(BedAllocation.is_active == True)
        ).all()

        inv_counter = 1
        pay_counter = 1
        rec_counter = 1
        dep_counter = 1

        for alloc in active_allocs:
            tenant = db.get(Tenant, alloc.tenant_id)
            room = db.get(Room, alloc.room_id)
            bed = db.get(Bed, alloc.bed_id)
            if not tenant or not room or not bed:
                continue

            # 1. Create Security Deposit
            sec_dep = Deposit(
                deposit_number=f"DEP-{year}-{dep_counter:04d}",
                tenant_id=tenant.id,
                deposit_type="Security Deposit",
                total_amount=10000.0,
                payment_date=f"{year}-01-10",
                payment_mode="UPI",
                transaction_ref=f"UPI{dep_counter}982736",
                adjusted_amount=0.0,
                refunded_amount=0.0,
                remaining_balance=10000.0,
                status="Active",
                remarks="Initial security deposit on admission"
            )
            db.add(sec_dep)
            db.flush()
            dep_counter += 1

            db.add(DepositTransaction(
                deposit_id=sec_dep.id,
                transaction_type="Collection",
                amount=10000.0,
                transaction_date=f"{year}-01-10",
                payment_mode="UPI",
                transaction_ref=sec_dep.transaction_ref,
                reason="Initial security deposit collected",
                recorded_by="admin"
            ))

            # 2. Generate Monthly Rent Invoice for current month
            inv_number = f"INV-{year}{month:02d}-{inv_counter:04d}"
            invoice = RentInvoice(
                invoice_number=inv_number,
                tenant_id=tenant.id,
                allocation_id=alloc.id,
                room_id=room.id,
                bed_id=bed.id,
                billing_month=month,
                billing_year=year,
                billing_date=f"{year}-{month:02d}-01",
                due_date=f"{year}-{month:02d}-10",
                base_rent=alloc.monthly_rent,
                total_amount=alloc.monthly_rent,
                amount_paid=0.0,
                pending_amount=alloc.monthly_rent,
                status="Unpaid",
                notes=f"Monthly rent for {calendar.month_name[month]} {year}"
            )
            db.add(invoice)
            db.flush()
            inv_counter += 1

            # Let 5 of the 8 tenants have already paid their rent
            if inv_counter <= 6:
                pay_number = f"PAY-{year}{month:02d}-{pay_counter:04d}"
                rec_number = f"REC-{year}{month:02d}-{rec_counter:04d}"

                payment = Payment(
                    payment_number=pay_number,
                    tenant_id=tenant.id,
                    invoice_id=invoice.id,
                    payment_date=f"{year}-{month:02d}-05",
                    amount=invoice.total_amount,
                    payment_type="Monthly Rent",
                    payment_mode="UPI" if inv_counter % 2 == 0 else "Bank Transfer",
                    transaction_ref=f"TXN{pay_counter}928374",
                    notes=f"Rent paid for {calendar.month_name[month]} {year}",
                    receipt_number=rec_number,
                    is_cancelled=False
                )
                db.add(payment)
                db.flush()

                invoice.amount_paid = invoice.total_amount
                invoice.pending_amount = 0.0
                invoice.status = "Paid"

                # Generate PDF receipt
                try:
                    pdf_file = generate_pdf_receipt(
                        receipt_number=rec_number,
                        payment_number=pay_number,
                        payment_date=payment.payment_date,
                        tenant_name=tenant.full_name,
                        tenant_code=tenant.tenant_code,
                        room_number=room.room_number,
                        bed_number=bed.bed_number,
                        payment_type=payment.payment_type,
                        billing_period=f"{calendar.month_name[month]} {year}",
                        amount_paid=payment.amount,
                        payment_mode=payment.payment_mode,
                        transaction_ref=payment.transaction_ref,
                        previous_balance=invoice.total_amount,
                        remaining_balance=0.0,
                        received_by="Administrator"
                    )
                    db.add(Receipt(
                        receipt_number=rec_number,
                        payment_id=payment.id,
                        tenant_id=tenant.id,
                        receipt_date=payment.payment_date,
                        pdf_filename=pdf_file
                    ))
                except Exception as ex:
                    logger.warning(f"Seed PDF receipt generation skipped: {ex}")

                pay_counter += 1
                rec_counter += 1

        # 3. Seed Monthly PG Expenses
        seed_expenses = [
            {"title": "Electricity Bill - Property Main Meter", "cat": "Electricity", "amt": 8450.0, "mode": "Bank Transfer", "to": "State Electricity Board", "date": f"{year}-{month:02d}-03"},
            {"title": "Monthly High-Speed Fiber Internet", "cat": "Internet / Wi-Fi", "amt": 2499.0, "mode": "UPI", "to": "Airtel Broadband", "date": f"{year}-{month:02d}-02"},
            {"title": "Drinking Water Cans & RO Filter Service", "cat": "Water", "amt": 3200.0, "mode": "Cash", "to": "Clean Aqua Supplies", "date": f"{year}-{month:02d}-04"},
            {"title": "Vegetables, Rice & Kitchen Groceries", "cat": "Food and Groceries", "amt": 16500.0, "mode": "UPI", "to": "Daily Fresh Wholesale", "date": f"{year}-{month:02d}-06"},
            {"title": "Cook & Housekeeping Staff Monthly Stipend", "cat": "Staff Salary", "amt": 18000.0, "mode": "Bank Transfer", "to": "Hostel Staff", "date": f"{year}-{month:02d}-05"},
            {"title": "Plumbing Maintenance & Washroom Fixes", "cat": "Maintenance", "amt": 1850.0, "mode": "Cash", "to": "City Plumbers", "date": f"{year}-{month:02d}-08"}
        ]

        exp_counter = 1
        for edata in seed_expenses:
            db.add(Expense(
                expense_number=f"EXP-{year}{month:02d}-{exp_counter:04d}",
                title=edata["title"],
                category=edata["cat"],
                description="Routine operational cost",
                amount=edata["amt"],
                expense_date=edata["date"],
                payment_mode=edata["mode"],
                paid_to=edata["to"],
                reference_number=f"REF{exp_counter}8372",
                remarks="Verified by property admin"
            ))
            exp_counter += 1

        db.commit()
        logger.info("Phase 3 financial baseline data seeded successfully.")

    # Always ensure Phase 4 services are seeded if not present
    seed_phase4_data(db)


def seed_phase4_data(db: Session):
    existing_food_plans = db.scalar(select(func.count(FoodPlan.id))) or 0
    if existing_food_plans > 0:
        return

    logger.info("Seeding Phase 4 Food, Facilities & Additional Services baseline data...")

    # 1. Food Plans
    food_plans = [
        {"code": "FP-FULL", "name": "Full Day Food", "desc": "Breakfast, Lunch and Dinner (Vegetarian & Non-Veg 2 days)", "price": 3500.0, "meals": "Breakfast, Lunch, Dinner"},
        {"code": "FP-BFDN", "name": "Breakfast + Dinner", "desc": "Morning breakfast and evening dinner for working professionals", "price": 2800.0, "meals": "Breakfast, Dinner"},
        {"code": "FP-BFLN", "name": "Breakfast + Lunch", "desc": "Morning breakfast and afternoon lunch", "price": 2500.0, "meals": "Breakfast, Lunch"},
        {"code": "FP-LUNCH", "name": "Lunch Only", "desc": "Afternoon meal subscription", "price": 1500.0, "meals": "Lunch"},
        {"code": "FP-BF", "name": "Breakfast Only", "desc": "Healthy morning breakfast", "price": 1200.0, "meals": "Breakfast"},
    ]
    created_plans = []
    for fp in food_plans:
        p = FoodPlan(
            plan_code=fp["code"],
            plan_name=fp["name"],
            description=fp["desc"],
            monthly_price=fp["price"],
            daily_price=round(fp["price"] / 30, 2),
            included_meals=fp["meals"],
            is_active=True
        )
        db.add(p)
        db.flush()
        created_plans.append(p)

    # 2. Wi-Fi Services
    wifi_services = [
        {"name": "MoonLight-HighSpeed-100M", "desc": "100 Mbps Dedicated Fiber Wi-Fi with unlimited data", "charge": 300.0},
        {"name": "MoonLight-Ultra-300M", "desc": "300 Mbps Ultra Low Latency Wi-Fi for heavy remote work/gaming", "charge": 500.0}
    ]
    created_wifi = []
    for ws in wifi_services:
        s = WifiService(
            network_name=ws["name"],
            description=ws["desc"],
            monthly_charge=ws["charge"],
            is_active=True
        )
        db.add(s)
        db.flush()
        created_wifi.append(s)

    # 3. Parking Slots (10 Two-wheeler, 5 Four-wheeler)
    created_slots = []
    for i in range(1, 11):
        slot = ParkingSlot(
            slot_number=f"P-2W-{i:02d}",
            slot_type="Two-wheeler",
            monthly_charge=300.0,
            status="Available",
            description=f"Basement two-wheeler designated parking bay #{i}"
        )
        db.add(slot)
        db.flush()
        created_slots.append(slot)

    for i in range(1, 6):
        slot = ParkingSlot(
            slot_number=f"P-4W-{i:02d}",
            slot_type="Four-wheeler",
            monthly_charge=1000.0,
            status="Available",
            description=f"Ground floor shaded four-wheeler parking bay #{i}"
        )
        db.add(slot)
        db.flush()
        created_slots.append(slot)

    # 4. Service Catalog
    catalog_items = [
        {"code": "SRV-LAUND", "name": "Laundry Service (40 Clothes)", "cat": "Laundry", "desc": "Washing, drying & iron pressing 40 clothes per month", "type": "Monthly", "price": 600.0},
        {"code": "SRV-CLEAN", "name": "Deep Room Cleaning", "cat": "Housekeeping", "desc": "Weekly bathroom deep clean & vacuuming", "type": "Monthly", "price": 400.0},
        {"code": "SRV-MATTR", "name": "Extra Foam Mattress & Pillow", "cat": "Other", "desc": "High density orthopedic mattress", "type": "Monthly", "price": 500.0},
        {"code": "SRV-VWASH", "name": "Two-Wheeler Water Pressure Wash", "cat": "Other", "desc": "Bi-weekly professional foam wash", "type": "Per Usage", "price": 150.0}
    ]
    created_catalog = []
    for cat in catalog_items:
        ci = ServiceCatalog(
            service_code=cat["code"],
            service_name=cat["name"],
            category=cat["cat"],
            description=cat["desc"],
            billing_type=cat["type"],
            price=cat["price"],
            billing_frequency="Monthly",
            is_active=True
        )
        db.add(ci)
        db.flush()
        created_catalog.append(ci)

    # 5. Electricity Meters & AC Rooms
    rooms = db.scalars(select(Room).order_by(Room.room_number)).all()
    created_meters = []
    for idx, rm in enumerate(rooms[:6]): # First 6 rooms get meters & AC
        rm.has_ac = True
        meter = ElectricityMeter(
            meter_number=f"MTR-RM{rm.room_number}",
            room_id=rm.id,
            meter_type="Digital Sub-meter",
            rate_per_unit=10.0,
            billing_method="Meter-based",
            status="Active"
        )
        db.add(meter)
        db.flush()
        created_meters.append(meter)

        # Add baseline reading
        rd = ElectricityReading(
            reading_number=f"ELEC-202611-{rm.room_number}-001",
            meter_id=meter.id,
            room_id=rm.id,
            billing_month=11,
            billing_year=2026,
            previous_reading=120.0 + (idx * 50),
            current_reading=210.0 + (idx * 50),
            units_consumed=90.0,
            rate_per_unit=10.0,
            total_amount=900.0,
            reading_date="2026-11-20",
            is_billed=False,
            remarks="Monthly meter check by caretaker"
        )
        db.add(rd)

        # Add AC Subscription for the room
        ac_sub = AcSubscription(
            subscription_number=f"AC-202611-RM{rm.room_number}",
            room_id=rm.id,
            billing_rule="room_split",
            monthly_charge=1500.0,
            split_among_occupants=True,
            status="Active",
            start_date="2026-11-01",
            remarks="Split equally among active room occupants"
        )
        db.add(ac_sub)

    # 6. Subscribe active tenants to food, Wi-Fi and allocate parking
    tenants = db.scalars(select(Tenant).where(Tenant.status == "Active").order_by(Tenant.id)).all()
    if tenants:
        # Tenant 1: Full day food + Wi-Fi + 2-Wheeler Parking
        t1 = tenants[0]
        db.add(FoodSubscription(
            subscription_number="FSUB-202611-0001",
            tenant_id=t1.id,
            plan_id=created_plans[0].id,
            start_date="2026-11-01",
            monthly_price=created_plans[0].monthly_price,
            status="Active",
            remarks="Full Day Food regular subscriber"
        ))
        db.add(WifiSubscription(
            subscription_number="WIFI-202611-0001",
            tenant_id=t1.id,
            wifi_service_id=created_wifi[0].id,
            activation_date="2026-11-01",
            monthly_charge=created_wifi[0].monthly_charge,
            included_in_rent=False,
            status="Active"
        ))
        slot1 = created_slots[0]
        slot1.status = "Occupied"
        db.add(ParkingAllocation(
            allocation_number="PARK-202611-0001",
            tenant_id=t1.id,
            slot_id=slot1.id,
            vehicle_type="Two-wheeler",
            vehicle_number="MH-12-AB-4501",
            allocation_date="2026-11-01",
            monthly_charge=slot1.monthly_charge,
            status="Active",
            remarks="Yamaha FZ bike"
        ))

        # Tenant 2: Breakfast + Dinner + Wi-Fi
        if len(tenants) > 1:
            t2 = tenants[1]
            db.add(FoodSubscription(
                subscription_number="FSUB-202611-0002",
                tenant_id=t2.id,
                plan_id=created_plans[1].id,
                start_date="2026-11-01",
                monthly_price=created_plans[1].monthly_price,
                status="Active",
                remarks="Breakfast and dinner subscriber"
            ))
            db.add(WifiSubscription(
                subscription_number="WIFI-202611-0002",
                tenant_id=t2.id,
                wifi_service_id=created_wifi[0].id,
                activation_date="2026-11-01",
                monthly_charge=created_wifi[0].monthly_charge,
                included_in_rent=False,
                status="Active"
            ))

        # Tenant 3: Laundry Custom Service + 4-Wheeler Parking
        if len(tenants) > 2:
            t3 = tenants[2]
            db.add(TenantServiceSubscription(
                subscription_number="SRV-LAUND-202611-0001",
                tenant_id=t3.id,
                service_id=created_catalog[0].id,
                start_date="2026-11-01",
                quantity=1,
                unit_price=created_catalog[0].price,
                total_amount=created_catalog[0].price,
                status="Active"
            ))
            slot_car = created_slots[10] # First four-wheeler slot
            slot_car.status = "Occupied"
            db.add(ParkingAllocation(
                allocation_number="PARK-202611-0002",
                tenant_id=t3.id,
                slot_id=slot_car.id,
                vehicle_type="Four-wheeler",
                vehicle_number="MH-14-CD-8899",
                allocation_date="2026-11-01",
                monthly_charge=slot_car.monthly_charge,
                status="Active",
                remarks="Hyundai i20"
            ))

        # Daily meal records for today
        today = datetime.now().strftime("%Y-%m-%d")
        db.add(MealRecord(
            meal_date=today,
            meal_type="Breakfast",
            tenant_id=t1.id,
            status="Served",
            remarks="Poha & Tea"
        ))
        db.add(MealRecord(
            meal_date=today,
            meal_type="Lunch",
            tenant_id=t1.id,
            status="Served",
            remarks="Rice, Dal & Roti"
        ))

    db.commit()
    logger.info("Phase 4 Food, Facilities & Additional Services baseline data seeded successfully.")

