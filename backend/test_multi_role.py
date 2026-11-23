import requests, sys

BASE_URL = "http://127.0.0.1:8000"

def test_roles():
    print("=== STARTING MULTI-ROLE & CLIENT ACCESS CONTROL TEST SUITE ===")
    
    # 1. Test Master Login
    print("[TEST 1] Testing Master Control Login...")
    s_master = requests.Session()
    r = s_master.post(f"{BASE_URL}/api/auth/login", json={"username": "master", "password": "MoonLightMaster2026!"})
    assert r.status_code == 200, f"Master login failed: {r.text}"
    user_master = r.json()
    assert user_master["role"] == "master", f"Expected role 'master', got {user_master['role']}"
    print("  -> Master authenticated PASS (role=master)")

    # 2. Test Admin Login
    print("[TEST 2] Testing Administrator Login...")
    s_admin = requests.Session()
    r = s_admin.post(f"{BASE_URL}/api/auth/login", json={"username": "admin", "password": "MoonLightAdmin2026!"})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    user_admin = r.json()
    assert user_admin["role"] == "admin", f"Expected role 'admin', got {user_admin['role']}"
    print("  -> Admin authenticated PASS (role=admin)")

    # 3. Test Client Logins
    client_usernames = ["client", "client1", "client2", "client3"]
    for c_user in client_usernames:
        print(f"[TEST 3] Testing Client Login '{c_user}'...")
        s_client = requests.Session()
        r = s_client.post(f"{BASE_URL}/api/auth/login", json={"username": c_user, "password": "MoonLightClient2026!"})
        assert r.status_code == 200, f"Client '{c_user}' login failed: {r.text}"
        user_c = r.json()
        assert user_c["role"] == "client", f"Expected role 'client', got {user_c['role']}"
        print(f"  -> Client '{c_user}' authenticated PASS (role=client)")

    # 4. Test Client Read Access (Can view data)
    print("[TEST 4] Testing Client Read-Only Authority (Can view application data)...")
    s_client = requests.Session()
    s_client.post(f"{BASE_URL}/api/auth/login", json={"username": "client", "password": "MoonLightClient2026!"})
    
    # Dashboard view
    r_dash = s_client.get(f"{BASE_URL}/api/dashboard")
    assert r_dash.status_code == 200, f"Dashboard read failed: {r_dash.text}"
    # Tenants view
    r_ten = s_client.get(f"{BASE_URL}/api/tenants")
    assert r_ten.status_code == 200, f"Tenants read failed: {r_ten.text}"
    # Rooms view
    r_rooms = s_client.get(f"{BASE_URL}/api/rooms")
    assert r_rooms.status_code == 200, f"Rooms read failed: {r_rooms.text}"
    # Financials view
    r_fin = s_client.get(f"{BASE_URL}/api/financial/dashboard")
    assert r_fin.status_code == 200, f"Financials read failed: {r_fin.text}"
    # Analytics overview
    r_anly = s_client.get(f"{BASE_URL}/api/analytics/overview")
    assert r_anly.status_code == 200, f"Analytics read failed: {r_anly.text}"
    # Reports history
    r_rep = s_client.get(f"{BASE_URL}/api/reports/history")
    assert r_rep.status_code == 200, f"Reports history read failed: {r_rep.text}"
    # System health
    r_hlth = s_client.get(f"{BASE_URL}/api/system/health")
    assert r_hlth.status_code == 200, f"System health read failed: {r_hlth.text}"
    print("  -> Client view-only browsing across Dashboard, Tenants, Rooms, Financials, Analytics & Reports PASS.")

    # 5. Test Client Write Blocking (STRICT 403 FORBIDDEN)
    print("[TEST 5] Testing Client Modification Blocking (Must return HTTP 403 Forbidden)...")
    
    # Attempt to create a tenant
    r_bad_ten = s_client.post(f"{BASE_URL}/api/tenants", json={
        "full_name": "Hacker Resident",
        "mobile": "9999999999",
        "gender": "Male",
        "joining_date": "2026-11-22"
    })
    assert r_bad_ten.status_code == 403, f"Expected 403 for client tenant creation, got {r_bad_ten.status_code}"
    print("  -> Client POST /api/tenants safely blocked with 403 Forbidden PASS.")

    # Attempt to create a room
    r_bad_room = s_client.post(f"{BASE_URL}/api/rooms", json={
        "room_number": "999",
        "floor": 9,
        "room_type": "Single",
        "monthly_rent": 9999.0,
        "capacity": 1
    })
    assert r_bad_room.status_code == 403, f"Expected 403 for client room creation, got {r_bad_room.status_code}"
    print("  -> Client POST /api/rooms safely blocked with 403 Forbidden PASS.")

    # Attempt to create a payment
    r_bad_pay = s_client.post(f"{BASE_URL}/api/payments", json={
        "tenant_id": 1,
        "amount": 5000,
        "payment_date": "2026-11-22",
        "payment_type": "Monthly Rent",
        "payment_mode": "Cash"
    })
    assert r_bad_pay.status_code == 403, f"Expected 403 for client payment creation, got {r_bad_pay.status_code}"
    print("  -> Client POST /api/payments safely blocked with 403 Forbidden PASS.")

    # Attempt to trigger backup
    r_bad_bak = s_client.post(f"{BASE_URL}/api/admin/backup")
    assert r_bad_bak.status_code == 403, f"Expected 403 for client backup creation, got {r_bad_bak.status_code}"
    print("  -> Client POST /api/admin/backup safely blocked with 403 Forbidden PASS.")

    # Attempt to create a task
    r_bad_tsk = s_client.post(f"{BASE_URL}/api/tasks", json={
        "title": "Unauthorized task",
        "category": "Maintenance",
        "priority": "Low"
    })
    assert r_bad_tsk.status_code == 403, f"Expected 403 for client task creation, got {r_bad_tsk.status_code}"
    print("  -> Client POST /api/tasks safely blocked with 403 Forbidden PASS.")

    # 6. Test Master and Admin Write Authority (Unrestricted)
    print("[TEST 6] Testing Master & Admin Write Authority...")
    r_ok_tsk = s_admin.post(f"{BASE_URL}/api/tasks", json={
        "title": "Admin authorized operational task",
        "category": "Maintenance",
        "priority": "Medium"
    })
    assert r_ok_tsk.status_code == 200, f"Admin task creation failed: {r_ok_tsk.text}"
    created_task = r_ok_tsk.json()
    print(f"  -> Admin task created successfully (#{created_task.get('task_code', created_task.get('id'))}) PASS.")

    # 7. Test User Management (Master Control)
    print("[TEST 7] Testing Master Control User Management...")
    r_users = s_master.get(f"{BASE_URL}/api/users")
    assert r_users.status_code == 200, f"Master get users failed: {r_users.text}"
    users_list = r_users.json()
    assert len(users_list) >= 4, f"Expected at least 4 users, got {len(users_list)}"
    usernames = [u["username"] for u in users_list]
    for req_u in ["master", "admin", "client"]:
        assert req_u in usernames, f"Missing user '{req_u}' in user list"
    print(f"  -> Master retrieved {len(users_list)} registered users: {usernames} PASS.")

    print("\n=== ALL MULTI-ROLE & CLIENT VIEW-ONLY ACCESS TESTS PASSED 100%! ===")

if __name__ == "__main__":
    test_roles()
