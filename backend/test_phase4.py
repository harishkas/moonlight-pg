import os, sys, requests, unittest
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000"

class TestPhase4Services(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.session = requests.Session()
        # Login with Phase 1 credentials
        login_resp = cls.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "MoonLightAdmin2026!"
        })
        if login_resp.status_code != 200:
            raise RuntimeError(f"Authentication failed: {login_resp.status_code} {login_resp.text}")
        print("\n=== PHASE 4: AUTHENTICATION OK ===")

    def test_01_create_and_list_food_plans(self):
        code = f"FP-TEST-{int(datetime.now().timestamp()) % 10000}"
        res = self.session.post(f"{BASE_URL}/api/food/plans", json={
            "plan_code": code,
            "plan_name": "Executive Gourmet Food",
            "description": "3 meals plus high protein evening snacks",
            "monthly_price": 4200.0,
            "daily_price": 140.0,
            "included_meals": "Breakfast, Lunch, Snacks, Dinner",
            "is_active": True
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["plan_code"], code)
        self.assertEqual(data["monthly_price"], 4200.0)

        # List plans
        list_res = self.session.get(f"{BASE_URL}/api/food/plans")
        self.assertEqual(list_res.status_code, 200)
        plans = list_res.json()
        self.assertTrue(len(plans) >= 5)
        print("Test 01: Create and List Food Plans PASS")

    def test_02_subscribe_tenant_to_food_plan(self):
        # Fetch an active tenant and food plan
        tenants = self.session.get(f"{BASE_URL}/api/tenants").json()
        active_t = [t for t in tenants if t["status"] == "Active"]
        self.assertTrue(len(active_t) > 0)
        t_id = active_t[-1]["id"] # Pick the last tenant

        plans = self.session.get(f"{BASE_URL}/api/food/plans").json()
        plan_id = plans[0]["id"]

        # Cancel any existing active sub for this tenant to allow new subscription
        existing_subs = self.session.get(f"{BASE_URL}/api/food/subscriptions?tenant_id={t_id}&status=Active").json()
        for s in existing_subs:
            self.session.put(f"{BASE_URL}/api/food/subscriptions/{s['id']}", json={"status": "Cancelled"})

        # Create new subscription
        res = self.session.post(f"{BASE_URL}/api/food/subscriptions", json={
            "tenant_id": t_id,
            "plan_id": plan_id,
            "start_date": "2026-11-15",
            "billing_frequency": "Monthly",
            "remarks": "Mid-month joining"
        })
        self.assertEqual(res.status_code, 200)
        sub = res.json()
        self.assertEqual(sub["status"], "Active")
        self.assertEqual(sub["tenant_id"], t_id)
        self.__class__.test_food_sub_id = sub["id"]
        print("Test 02: Subscribe Tenant to Food Plan PASS")

    def test_03_pause_and_resume_food_subscription(self):
        sub_id = getattr(self.__class__, "test_food_sub_id", None)
        self.assertIsNotNone(sub_id)

        # Pause
        pause_res = self.session.put(f"{BASE_URL}/api/food/subscriptions/{sub_id}", json={
            "status": "Paused",
            "remarks": "Tenant traveling for 1 week"
        })
        self.assertEqual(pause_res.status_code, 200)
        self.assertEqual(pause_res.json()["status"], "Paused")

        # Resume
        resume_res = self.session.put(f"{BASE_URL}/api/food/subscriptions/{sub_id}", json={
            "status": "Active",
            "remarks": "Tenant resumed subscription"
        })
        self.assertEqual(resume_res.status_code, 200)
        self.assertEqual(resume_res.json()["status"], "Active")
        print("Test 03: Pause and Resume Food Subscription PASS")

    def test_04_record_daily_meals_and_summary(self):
        tenants = self.session.get(f"{BASE_URL}/api/tenants").json()
        t_id = tenants[0]["id"]
        today = datetime.now().strftime("%Y-%m-%d")

        # Record meal
        res = self.session.post(f"{BASE_URL}/api/food/meals", json={
            "meal_date": today,
            "meal_type": "Dinner",
            "tenant_id": t_id,
            "status": "Additional Request",
            "extra_charge": 120.0,
            "remarks": "Extra guest meal"
        })
        self.assertEqual(res.status_code, 200)
        rec = res.json()
        self.assertEqual(rec["extra_charge"], 120.0)

        # Check summary
        sum_res = self.session.get(f"{BASE_URL}/api/food/meals/summary?date={today}")
        self.assertEqual(sum_res.status_code, 200)
        summary = sum_res.json()
        self.assertTrue(summary["additional_requests_count"] >= 1)
        self.assertTrue(summary["total_extra_charges"] >= 120.0)
        print("Test 04: Record Daily Meals and Summary PASS")

    def test_05_wifi_management(self):
        services = self.session.get(f"{BASE_URL}/api/services/wifi").json()
        self.assertTrue(len(services) >= 1)
        srv_id = services[0]["id"]

        tenants = self.session.get(f"{BASE_URL}/api/tenants").json()
        t_id = tenants[3]["id"]

        # Cancel any active Wi-Fi for t_id
        subs = self.session.get(f"{BASE_URL}/api/services/wifi/subscriptions?tenant_id={t_id}&status=Active").json()
        for s in subs:
            self.session.put(f"{BASE_URL}/api/services/wifi/subscriptions/{s['id']}?status=Inactive")

        # Activate Wi-Fi
        res = self.session.post(f"{BASE_URL}/api/services/wifi/subscriptions", json={
            "tenant_id": t_id,
            "wifi_service_id": srv_id,
            "activation_date": "2026-11-01",
            "monthly_charge": 300.0,
            "included_in_rent": False
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "Active")

        # Duplicate activation test
        dup_res = self.session.post(f"{BASE_URL}/api/services/wifi/subscriptions", json={
            "tenant_id": t_id,
            "wifi_service_id": srv_id,
            "activation_date": "2026-11-01"
        })
        self.assertEqual(dup_res.status_code, 400)
        print("Test 05: Wi-Fi Management and Duplicate Prevention PASS")

    def test_06_parking_allocation_and_double_allocation_prevention(self):
        slots = self.session.get(f"{BASE_URL}/api/parking/slots").json()
        avail_slots = [s for s in slots if s["status"] == "Available"]
        self.assertTrue(len(avail_slots) > 0)
        slot = avail_slots[0]

        tenants = self.session.get(f"{BASE_URL}/api/tenants").json()
        t_id = tenants[4]["id"]

        # Allocate slot
        veh_num = f"KA-03-XY-{int(datetime.now().timestamp()) % 10000:04d}"
        alloc_res = self.session.post(f"{BASE_URL}/api/parking/allocations", json={
            "tenant_id": t_id,
            "slot_id": slot["id"],
            "vehicle_type": slot["slot_type"],
            "vehicle_number": veh_num,
            "allocation_date": "2026-11-01",
            "monthly_charge": slot["monthly_charge"]
        })
        self.assertEqual(alloc_res.status_code, 200)
        alloc = alloc_res.json()
        self.assertEqual(alloc["status"], "Active")
        self.__class__.test_parking_alloc_id = alloc["id"]
        self.__class__.test_parking_slot_id = slot["id"]

        # Double allocation attempt on same slot -> MUST FAIL
        dup_alloc = self.session.post(f"{BASE_URL}/api/parking/allocations", json={
            "tenant_id": tenants[5]["id"],
            "slot_id": slot["id"],
            "vehicle_type": slot["slot_type"],
            "vehicle_number": "KA-01-DUP-9999",
            "allocation_date": "2026-11-01"
        })
        self.assertEqual(dup_alloc.status_code, 400)
        print("Test 06: Parking Allocation and Double Allocation Prevention PASS")

    def test_07_parking_slot_release(self):
        alloc_id = getattr(self.__class__, "test_parking_alloc_id", None)
        slot_id = getattr(self.__class__, "test_parking_slot_id", None)
        self.assertIsNotNone(alloc_id)

        # Release allocation
        rel_res = self.session.post(f"{BASE_URL}/api/parking/allocations/{alloc_id}/release", json={
            "release_date": "2026-11-20",
            "remarks": "Tenant sold vehicle"
        })
        self.assertEqual(rel_res.status_code, 200)
        self.assertEqual(rel_res.json()["status"], "Released")

        # Verify slot status is back to Available
        slots = self.session.get(f"{BASE_URL}/api/parking/slots").json()
        released_slot = next(s for s in slots if s["id"] == slot_id)
        self.assertEqual(released_slot["status"], "Available")
        print("Test 07: Parking Slot Release and Status Reset PASS")

    def test_08_ac_management(self):
        rooms = self.session.get(f"{BASE_URL}/api/rooms").json()
        r = rooms[0]

        # Configure room AC
        cfg_res = self.session.post(f"{BASE_URL}/api/services/ac/configure-room?room_id={r['id']}&has_ac=true")
        self.assertEqual(cfg_res.status_code, 200)

        # Create AC subscription
        ac_res = self.session.post(f"{BASE_URL}/api/services/ac/subscriptions", json={
            "room_id": r["id"],
            "billing_rule": "room_split",
            "monthly_charge": 1600.0,
            "split_among_occupants": True,
            "start_date": "2026-11-01",
            "remarks": "High efficiency Inverter AC"
        })
        self.assertEqual(ac_res.status_code, 200)
        self.assertEqual(ac_res.json()["monthly_charge"], 1600.0)
        print("Test 08: AC Management and Room Subscription PASS")

    def test_09_electricity_meter_and_readings(self):
        meters = self.session.get(f"{BASE_URL}/api/electricity/meters").json()
        self.assertTrue(len(meters) > 0)
        meter = meters[0]

        # Read last reading
        last_reading = meter["latest_reading"] or 0.0

        # Attempt invalid lower reading -> MUST FAIL
        inv_res = self.session.post(f"{BASE_URL}/api/electricity/readings", json={
            "meter_id": meter["id"],
            "billing_month": 11,
            "billing_year": 2026,
            "current_reading": last_reading - 10.0,
            "reading_date": "2026-11-22"
        })
        self.assertEqual(inv_res.status_code, 400)

        # Record valid reading
        cur_rd = last_reading + 45.0
        val_res = self.session.post(f"{BASE_URL}/api/electricity/readings", json={
            "meter_id": meter["id"],
            "billing_month": 11,
            "billing_year": 2026,
            "current_reading": cur_rd,
            "previous_reading": last_reading,
            "rate_per_unit": 10.0,
            "reading_date": "2026-11-22",
            "remarks": "Mid-month check"
        })
        self.assertEqual(val_res.status_code, 200)
        rd_data = val_res.json()
        self.assertEqual(rd_data["units_consumed"], 45.0)
        self.assertEqual(rd_data["total_amount"], 450.0)
        print("Test 09: Electricity Readings, Calculation and Validation PASS")

    def test_10_additional_services_catalog_and_subscriptions(self):
        code = f"SRV-TEST-{int(datetime.now().timestamp()) % 10000}"
        res = self.session.post(f"{BASE_URL}/api/services/catalog", json={
            "service_code": code,
            "service_name": "Premium High-Speed Ironing",
            "category": "Laundry",
            "description": "Weekly ironing 30 clothes",
            "billing_type": "Monthly",
            "price": 350.0,
            "is_active": True
        })
        self.assertEqual(res.status_code, 200)
        srv = res.json()
        self.assertEqual(srv["service_code"], code)

        # Subscribe tenant
        tenants = self.session.get(f"{BASE_URL}/api/tenants").json()
        t_id = tenants[0]["id"]
        sub_res = self.session.post(f"{BASE_URL}/api/services/subscriptions", json={
            "tenant_id": t_id,
            "service_id": srv["id"],
            "start_date": "2026-11-01",
            "quantity": 2, # 2 packages = Rs. 700
            "remarks": "Two packages requested"
        })
        self.assertEqual(sub_res.status_code, 200)
        sub_data = sub_res.json()
        self.assertEqual(sub_data["total_amount"], 700.0)
        print("Test 10: Additional Services Catalog & Subscriptions PASS")

    def test_11_centralized_service_billing_generation(self):
        # Generate service charges for 11/2026
        res = self.session.post(f"{BASE_URL}/api/services/billing/generate", json={
            "billing_month": 11,
            "billing_year": 2026,
            "due_date": "2026-11-28",
            "integrate_with_rent_invoice": False
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["charges_generated"] >= 1 or data["duplicates_skipped"] >= 1)

        # Run again to verify duplicate prevention
        dup_res = self.session.post(f"{BASE_URL}/api/services/billing/generate", json={
            "billing_month": 11,
            "billing_year": 2026,
            "due_date": "2026-11-28"
        })
        self.assertEqual(dup_res.status_code, 200)
        dup_data = dup_res.json()
        self.assertTrue(dup_data["duplicates_skipped"] >= 1)
        print("Test 11: Centralized Service Billing Generation & Duplicate Prevention PASS")

    def test_12_pay_service_charge_with_receipt(self):
        # Fetch unpaid charges
        charges = self.session.get(f"{BASE_URL}/api/services/billing/charges?status=Unpaid").json()
        self.assertTrue(len(charges) > 0)
        chg = charges[0]

        pay_amount = min(500.0, chg["pending_amount"])
        res = self.session.post(f"{BASE_URL}/api/services/billing/pay", json={
            "charge_id": chg["id"],
            "amount": pay_amount,
            "payment_mode": "UPI",
            "transaction_ref": "UPI-SRV-992138",
            "notes": "Testing service charge payment via Phase 3 engine"
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("receipt_number", data)
        self.assertIn("payment_number", data)
        self.assertEqual(data["remaining_pending"], round(chg["pending_amount"] - pay_amount, 2))
        print("Test 12: Pay Service Charge with Phase 3 Payment Integration & Receipt PASS")

    def test_13_services_dashboard_and_reports(self):
        # Services Dashboard
        dash_res = self.session.get(f"{BASE_URL}/api/services/dashboard")
        self.assertEqual(dash_res.status_code, 200)
        dash = dash_res.json()
        self.assertTrue(dash["active_food_subscribers"] >= 1)
        self.assertTrue(dash["monthly_food_revenue"] > 0)
        self.assertTrue(dash["active_wifi_subscribers"] >= 1)
        self.assertTrue(dash["total_service_charges_generated"] > 0)

        # Revenue Report
        rev_res = self.session.get(f"{BASE_URL}/api/services/reports/revenue?year=2026")
        self.assertEqual(rev_res.status_code, 200)

        # Electricity Report
        elec_res = self.session.get(f"{BASE_URL}/api/services/reports/electricity?month=11&year=2026")
        self.assertEqual(elec_res.status_code, 200)

        # CSV Export
        csv_res = self.session.get(f"{BASE_URL}/api/services/reports/export-csv")
        self.assertEqual(csv_res.status_code, 200)
        self.assertIn("text/csv", csv_res.headers.get("content-type", ""))
        self.assertTrue(len(csv_res.content) > 50)
        print("Test 13: Services Dashboard, Reports and CSV Export PASS")

    def test_14_pdf_service_statement_download(self):
        tenants = self.session.get(f"{BASE_URL}/api/tenants").json()
        t_id = tenants[0]["id"]
        pdf_res = self.session.get(f"{BASE_URL}/api/services/reports/statement-pdf/{t_id}")
        self.assertEqual(pdf_res.status_code, 200)
        self.assertIn("application/pdf", pdf_res.headers.get("content-type", ""))
        self.assertTrue(len(pdf_res.content) > 1000) # Valid generated PDF
        print("Test 14: PDF Tenant Service Statement Download PASS")

    def test_15_phase_1_2_3_regression_check(self):
        # Phase 1: Auth and System Dashboard
        dash = self.session.get(f"{BASE_URL}/api/dashboard").json()
        self.assertEqual(dash["property_name"], "Moon Light PG")
        self.assertTrue(dash["total_rooms"] >= 15)
        self.assertTrue(dash["total_beds"] >= 30)

        # Phase 2: Tenants and Rooms
        tenants = self.session.get(f"{BASE_URL}/api/tenants").json()
        self.assertTrue(len(tenants) >= 8)

        # Phase 3: Financial Dashboard
        fin_dash = self.session.get(f"{BASE_URL}/api/financial/dashboard").json()
        self.assertTrue(fin_dash["total_operating_income"] >= 0)
        self.assertTrue(fin_dash["refundable_deposits_held"] >= 0)

        print("Test 15: Phase 1, Phase 2, and Phase 3 Regression Check ALL PASS")

if __name__ == "__main__":
    unittest.main()
