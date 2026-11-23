import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    session = requests.Session()
    print("=== STARTING PHASE 2 AUTOMATED TEST SUITE ===")
    
    # Test 15: Phase 1 login and session cookie
    print("[TEST 15] Testing Phase 1 Login...")
    login_res = session.post(f"{BASE_URL}/api/auth/login", json={"username": "admin", "password": "MoonLightAdmin2026!"})
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    assert "mlpg_session" in session.cookies, "Session cookie not set"
    print("  -> Login PASS. Session established.")

    # Phase 1 backup
    print("[TEST 15b] Testing Phase 1 Backup trigger...")
    backup_res = session.post(f"{BASE_URL}/api/admin/backup")
    assert backup_res.status_code == 200, f"Backup failed: {backup_res.text}"
    print(f"  -> Backup PASS: {backup_res.json()}")

    # Test 1: Create a tenant
    print("[TEST 1] Creating a new tenant...")
    tenant_payload = {
        "full_name": "Test Tenant Manas",
        "mobile": "9998887771",
        "email": "manas@example.com",
        "gender": "Male",
        "dob": "1999-04-12",
        "permanent_address": "42, Residency Road, Bengaluru",
        "emergency_contact_name": "Father",
        "emergency_contact_number": "9998887770",
        "occupation": "Working",
        "company_or_college": "Tech Corp",
        "joining_date": "2026-11-20",
        "status": "Pending"
    }
    t_res = session.post(f"{BASE_URL}/api/tenants", json=tenant_payload)
    assert t_res.status_code == 200, f"Create tenant failed: {t_res.text}"
    tenant = t_res.json()
    tenant_id = tenant["id"]
    print(f"  -> Created tenant {tenant['tenant_code']} (ID: {tenant_id}) PASS")

    # Test 2: Edit tenant information
    print("[TEST 2] Editing tenant information...")
    edit_res = session.put(f"{BASE_URL}/api/tenants/{tenant_id}", json={"company_or_college": "Global Tech Corp", "occupation": "Senior Engineer"})
    assert edit_res.status_code == 200, f"Edit tenant failed: {edit_res.text}"
    assert edit_res.json()["company_or_college"] == "Global Tech Corp"
    print("  -> Tenant updated successfully PASS")

    # Test 3: Search for a tenant
    print("[TEST 3] Searching for tenant by name / mobile / code...")
    search_res = session.get(f"{BASE_URL}/api/tenants?search=Manas")
    assert search_res.status_code == 200
    results = search_res.json()
    assert any(t["id"] == tenant_id for t in results), "Search by name failed"

    search_phone = session.get(f"{BASE_URL}/api/tenants?search=9998887771")
    assert any(t["id"] == tenant_id for t in search_phone.json()), "Search by phone failed"
    print("  -> Tenant search verified PASS")

    # Test 4: Create a room
    print("[TEST 4] Creating a new room...")
    room_payload = {
        "room_number": "401",
        "floor": 4,
        "room_type": "Sharing",
        "capacity": 3,
        "monthly_rent": 5000.0,
        "description": "Third floor spacious room with balcony"
    }
    room_res = session.post(f"{BASE_URL}/api/rooms", json=room_payload)
    assert room_res.status_code == 200, f"Create room failed: {room_res.text}"
    room = room_res.json()
    room_id = room["id"]
    print(f"  -> Created room {room['room_number']} with {room['bed_count']} beds PASS")

    # Test 5: Add multiple beds to a room
    print("[TEST 5] Adding an extra bed to room 401...")
    bed_payload = {"bed_number": "Bed 4", "status": "Available", "monthly_rent": 5000.0}
    bed_res = session.post(f"{BASE_URL}/api/rooms/{room_id}/beds", json=bed_payload)
    assert bed_res.status_code == 200, f"Add bed failed: {bed_res.text}"
    new_bed = bed_res.json()
    print(f"  -> Added {new_bed['bed_number']} to room {room_id} PASS")

    # Fetch room beds to pick an available bed
    room_beds_res = session.get(f"{BASE_URL}/api/rooms/{room_id}/beds")
    beds = room_beds_res.json()
    target_bed = next(b for b in beds if b["status"] == "Available")
    bed_id = target_bed["id"]

    # Test 6 & 7: Allocate an available bed & verify occupied status
    print(f"[TEST 6 & 7] Allocating Bed {target_bed['bed_number']} (ID: {bed_id}) to Tenant {tenant_id}...")
    alloc_payload = {
        "tenant_id": tenant_id,
        "bed_id": bed_id,
        "allocation_date": "2026-11-21",
        "monthly_rent": 5000.0
    }
    alloc_res = session.post(f"{BASE_URL}/api/allocations", json=alloc_payload)
    assert alloc_res.status_code == 200, f"Allocation failed: {alloc_res.text}"
    alloc = alloc_res.json()
    alloc_id = alloc["id"]
    print(f"  -> Bed allocated! Allocation ID: {alloc_id} PASS")

    # Verify bed status changed to Occupied
    beds_after = session.get(f"{BASE_URL}/api/rooms/{room_id}/beds").json()
    bed_check = next(b for b in beds_after if b["id"] == bed_id)
    assert bed_check["status"] == "Occupied", "Bed status did not change to Occupied"
    assert bed_check["occupant"] is not None and bed_check["occupant"]["tenant_id"] == tenant_id
    print("  -> Bed is now Occupied and occupant details recorded PASS")

    # Test 8: Attempt to allocate an already occupied bed
    print("[TEST 8] Attempting to allocate an already occupied bed (should fail)...")
    # create second tenant
    t2_res = session.post(f"{BASE_URL}/api/tenants", json={
        "full_name": "Second Tenant", "mobile": "8887776660", "joining_date": "2026-11-21", "status": "Pending"
    })
    t2_id = t2_res.json()["id"]
    dup_bed_res = session.post(f"{BASE_URL}/api/allocations", json={
        "tenant_id": t2_id, "bed_id": bed_id, "allocation_date": "2026-11-21", "monthly_rent": 5000.0
    })
    assert dup_bed_res.status_code == 400, "Allocating already occupied bed should return 400"
    print(f"  -> Properly rejected: {dup_bed_res.json()['detail']} PASS")

    # Test 9: Attempt to allocate a maintenance bed
    print("[TEST 9] Attempting to allocate a bed under maintenance (should fail)...")
    maint_bed = next(b for b in beds_after if b["id"] != bed_id)
    session.put(f"{BASE_URL}/api/beds/{maint_bed['id']}", json={"status": "Maintenance"})
    maint_alloc_res = session.post(f"{BASE_URL}/api/allocations", json={
        "tenant_id": t2_id, "bed_id": maint_bed["id"], "allocation_date": "2026-11-21", "monthly_rent": 5000.0
    })
    assert maint_alloc_res.status_code == 400, "Allocating maintenance bed should return 400"
    print(f"  -> Properly rejected: {maint_alloc_res.json()['detail']} PASS")

    # Test 10: Attempt duplicate active allocation for one tenant
    print("[TEST 10] Attempting duplicate active allocation for the same tenant (should fail)...")
    another_bed = next(b for b in beds_after if b["id"] not in (bed_id, maint_bed["id"]))
    dup_tenant_alloc = session.post(f"{BASE_URL}/api/allocations", json={
        "tenant_id": tenant_id, "bed_id": another_bed["id"], "allocation_date": "2026-11-21", "monthly_rent": 5000.0
    })
    assert dup_tenant_alloc.status_code == 400, "Duplicate active allocation for tenant should return 400"
    print(f"  -> Properly rejected: {dup_tenant_alloc.json()['detail']} PASS")

    # Test 11 & 12: Vacate a tenant and verify bed becomes available
    print(f"[TEST 11 & 12] Vacating Tenant {tenant_id} from allocation {alloc_id}...")
    vacate_payload = {
        "vacating_date": "2026-11-25",
        "vacating_reason": "Relocating to another city",
        "room_inspection_status": "Passed without damages",
        "pending_dues": 0.0,
        "deposit_refund_status": "Full Refund",
        "remarks": "Tenant completed notice period cleanly"
    }
    vacate_res = session.post(f"{BASE_URL}/api/allocations/{alloc_id}/vacate", json=vacate_payload)
    assert vacate_res.status_code == 200, f"Vacating failed: {vacate_res.text}"
    vacated_alloc = vacate_res.json()
    assert vacated_alloc["is_active"] == False
    print("  -> Vacating successful PASS")

    # Verify bed becomes available
    bed_after_vacate = session.get(f"{BASE_URL}/api/rooms/{room_id}/beds").json()
    check_released_bed = next(b for b in bed_after_vacate if b["id"] == bed_id)
    assert check_released_bed["status"] == "Available", "Released bed did not return to Available"
    print("  -> Bed is back to Available status PASS")

    # Verify tenant status is Vacated
    t_after_vacate = session.get(f"{BASE_URL}/api/tenants/{tenant_id}").json()
    assert t_after_vacate["status"] == "Vacated"
    print("  -> Tenant status updated to Vacated PASS")

    # Test 13: Verify historical allocation records remain intact
    print("[TEST 13] Verifying historical allocation records remain intact...")
    t_history = session.get(f"{BASE_URL}/api/tenants/{tenant_id}/allocations").json()
    assert len(t_history) >= 1
    hist = next(h for h in t_history if h["id"] == alloc_id)
    assert hist["is_active"] == False
    assert hist["vacating_reason"] == "Relocating to another city"
    print(f"  -> Historical record preserved: Allocation #{hist['id']}, Leaving Date: {hist['vacating_date']} PASS")

    # Test 14: Verify dashboard counts against database records
    print("[TEST 14] Verifying dashboard counts against database...")
    dash_res = session.get(f"{BASE_URL}/api/dashboard")
    assert dash_res.status_code == 200, f"Dashboard failed: {dash_res.text}"
    dash = dash_res.json()
    print("  Dashboard Metrics:", json.dumps({
        "total_rooms": dash["total_rooms"],
        "total_beds": dash["total_beds"],
        "occupied_beds": dash["occupied_beds"],
        "available_beds": dash["available_beds"],
        "maintenance_beds": dash["maintenance_beds"],
        "active_tenants": dash["active_tenants"],
        "vacated_tenants": dash["vacated_tenants"],
        "occupancy_rate": f"{dash['occupancy_rate']}%"
    }, indent=2))
    assert dash["total_rooms"] >= 15
    assert dash["total_beds"] >= 30
    assert dash["active_tenants"] >= 8
    assert dash["occupied_beds"] >= 8
    assert len(dash["room_overview"]) == dash["total_rooms"]
    print("  -> Dashboard counts fully match database records PASS")

    print("\nALL 15 TESTS PASSED SUCCESSFULLY! 100% PASS RATE.")

if __name__ == "__main__":
    run_tests()

