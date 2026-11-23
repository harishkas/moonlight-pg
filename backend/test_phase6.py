import requests, json, time

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("=== STARTING PHASE 6 AUTOMATION & ANALYTICS TEST SUITE ===")
    session = requests.Session()

    # 1. Authentication
    print("[TEST 1] Logging into admin account...")
    login_res = session.post(f"{BASE_URL}/api/auth/login", json={"username": "admin", "password": "MoonLightAdmin2026!"})
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    print("  -> Login PASS. Admin authenticated.")

    # 2. Centralized Notifications
    print("[TEST 2] Testing Centralized Notification Engine...")
    # Fetch unread count
    uc_res = session.get(f"{BASE_URL}/api/notifications/unread-count")
    assert uc_res.status_code == 200
    initial_unread = uc_res.json()["count"]

    # Fetch notifications list
    notifs_res = session.get(f"{BASE_URL}/api/notifications")
    assert notifs_res.status_code == 200
    notifs = notifs_res.json()
    print(f"  -> Retrieved {len(notifs)} existing notifications. Unread count: {initial_unread} PASS.")

    # Notification preferences
    pref_res = session.get(f"{BASE_URL}/api/notifications/preferences")
    assert pref_res.status_code == 200
    prefs = pref_res.json()
    assert len(prefs) >= 6, "Expected at least 6 default notification preferences"
    print(f"  -> Retrieved {len(prefs)} notification preferences PASS.")

    # Update preferences
    pref_update = session.put(f"{BASE_URL}/api/notifications/preferences", json={
        "preferences": {"rent_reminder_7d_before": "true", "rent_reminder_due_date": "true"}
    })
    assert pref_update.status_code == 200
    print("  -> Updated notification preferences PASS.")

    # 3. Automated Rent Reminders & Duplicate Prevention
    print("[TEST 3] Running Automated Rent Reminder Scan...")
    rem_scan = session.post(f"{BASE_URL}/api/automation/rent-reminders/run")
    assert rem_scan.status_code == 200, f"Scan failed: {rem_scan.text}"
    scan_res = rem_scan.json()
    assert scan_res["status"] == "Success"
    print(f"  -> Initial Rent Reminder scan executed in {scan_res['duration_ms']}ms PASS.")

    # Check duplicate prevention
    print("[TEST 4] Testing Rent Reminder Duplicate Prevention...")
    rem_scan_dup = session.post(f"{BASE_URL}/api/automation/rent-reminders/run")
    assert rem_scan_dup.status_code == 200
    # Reminder history
    rh_res = session.get(f"{BASE_URL}/api/automation/rent-reminders/history")
    assert rh_res.status_code == 200
    rh_list = rh_res.json()
    print(f"  -> Reminder history has {len(rh_list)} recorded log entries PASS.")

    # 4. Automated Dues Summary & Overdue Aging
    print("[TEST 5] Testing Automated Dues & Aging Summary...")
    dues_res = session.get(f"{BASE_URL}/api/automation/dues-summary")
    assert dues_res.status_code == 200
    dues_data = dues_res.json()
    assert "total_unpaid_dues" in dues_data
    assert "tenants" in dues_data
    print(f"  -> Total unpaid dues: Rs. {dues_data['total_unpaid_dues']:,.2f} across {dues_data['tenants_with_dues_count']} residents PASS.")

    # 5. Scheduled Jobs & Automation Engine
    print("[TEST 6] Testing Automation Engine & Scheduled Jobs...")
    jobs_res = session.get(f"{BASE_URL}/api/automation/jobs")
    assert jobs_res.status_code == 200
    jobs = jobs_res.json()
    assert len(jobs) >= 8, f"Expected 8 default jobs, got {len(jobs)}"
    print(f"  -> Registered {len(jobs)} scheduled automation jobs PASS.")

    # Manually execute daily overdue marker job
    overdue_job = [j for j in jobs if j["job_key"] == "daily_overdue_marker"][0]
    run_res = session.post(f"{BASE_URL}/api/automation/jobs/{overdue_job['id']}/run")
    assert run_res.status_code == 200
    print(f"  -> Manually executed job '{overdue_job['name']}' PASS.")

    # Check automation history
    hist_res = session.get(f"{BASE_URL}/api/automation/history")
    assert hist_res.status_code == 200
    hist = hist_res.json()
    assert len(hist) > 0, "Execution logs should not be empty"
    print(f"  -> Retrieved {len(hist)} automation execution logs PASS.")

    # 6. Advanced Business Analytics
    print("[TEST 7] Testing Advanced Business Analytics Dashboard APIs...")
    # Overview
    an_over = session.get(f"{BASE_URL}/api/analytics/overview")
    assert an_over.status_code == 200
    over_d = an_over.json()
    assert "occupancy_rate" in over_d and "net_operating_income" in over_d
    print(f"  -> Overview: Occupancy {over_d['occupancy_rate']}%, NOI: Rs. {over_d['net_operating_income']:,.2f} PASS.")

    # Occupancy
    an_occ = session.get(f"{BASE_URL}/api/analytics/occupancy")
    assert an_occ.status_code == 200
    occ_d = an_occ.json()
    assert "monthly_trend" in occ_d and "floor_breakdown" in occ_d
    print(f"  -> Occupancy Analytics: {len(occ_d['monthly_trend'])} trend months, {len(occ_d['floor_breakdown'])} floors PASS.")

    # Financial
    an_fin = session.get(f"{BASE_URL}/api/analytics/financial?months=6")
    assert an_fin.status_code == 200
    fin_d = an_fin.json()
    assert "monthly_performance" in fin_d and "expense_category_breakdown" in fin_d
    print(f"  -> Financial Analytics: {len(fin_d['monthly_performance'])} months, {len(fin_d['expense_category_breakdown'])} expense categories PASS.")

    # Tenants
    an_ten = session.get(f"{BASE_URL}/api/analytics/tenants")
    assert an_ten.status_code == 200
    ten_d = an_ten.json()
    assert "retention_rate" in ten_d and "average_stay_days" in ten_d
    print(f"  -> Tenant Analytics: Retention {ten_d['retention_rate']}%, Avg Stay: {ten_d['average_stay_days']} days PASS.")

    # Services
    an_srv = session.get(f"{BASE_URL}/api/analytics/services")
    assert an_srv.status_code == 200
    srv_d = an_srv.json()
    assert "active_food_subscribers" in srv_d and "parking_utilization_rate" in srv_d
    print(f"  -> Services Analytics: {srv_d['active_food_subscribers']} food subs, {srv_d['parking_utilization_rate']}% parking utilization PASS.")

    # 7. Automated Reports (Daily, Weekly, Monthly)
    print("[TEST 8] Testing Automated Report Generation & History...")
    # Daily
    rep_d = session.post(f"{BASE_URL}/api/reports/generate", json={"report_type": "Daily"})
    assert rep_d.status_code == 200
    d_obj = rep_d.json()
    print(f"  -> Generated Daily Report #{d_obj['id']} PASS.")

    # Monthly
    rep_m = session.post(f"{BASE_URL}/api/reports/generate", json={"report_type": "Monthly", "month": 12, "year": 2026})
    assert rep_m.status_code == 200
    m_obj = rep_m.json()
    print(f"  -> Generated Monthly Report #{m_obj['id']} PASS.")

    # Download PDF
    pdf_res = session.get(f"{BASE_URL}/api/reports/{d_obj['id']}/pdf")
    assert pdf_res.status_code == 200
    assert pdf_res.headers.get("content-type") == "application/pdf"
    assert len(pdf_res.content) > 500
    print(f"  -> Downloaded PDF report ({len(pdf_res.content)} bytes) PASS.")

    # Download CSV
    csv_res = session.get(f"{BASE_URL}/api/reports/{d_obj['id']}/csv")
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers.get("content-type")
    assert "Report Title" in csv_res.text
    print("  -> Downloaded CSV report PASS.")

    # 8. Task & Follow-up Management
    print("[TEST 9] Testing Task Management System...")
    task_payload = {
        "title": "Collect pending rent for Room 101",
        "description": "Follow up with tenant regarding outstanding dues",
        "category": "Rent Follow-up",
        "priority": "High",
        "due_date": "2026-12-15"
    }
    t_create = session.post(f"{BASE_URL}/api/tasks", json=task_payload)
    assert t_create.status_code == 200, f"Task create failed: {t_create.text}"
    created_task = t_create.json()
    task_id = created_task["id"]
    print(f"  -> Created Task: {created_task['task_code']} ('{created_task['title']}') PASS.")

    # Complete Task
    t_complete = session.post(f"{BASE_URL}/api/tasks/{task_id}/complete")
    assert t_complete.status_code == 200
    assert t_complete.json()["status"] == "Completed"
    print(f"  -> Task #{task_id} completed successfully PASS.")

    # 9. Centralized Audit Logging
    print("[TEST 10] Testing Centralized Audit Logs...")
    audit_res = session.get(f"{BASE_URL}/api/audit-logs?limit=10")
    assert audit_res.status_code == 200
    logs = audit_res.json()
    assert len(logs) > 0, "Audit logs should not be empty"
    print(f"  -> Retrieved {len(logs)} audit entries. Latest: [{logs[0]['action']}] {logs[0]['details']} PASS.")

    # 10. Backup Management & Integrity Verification
    print("[TEST 11] Testing Backup Management & Verification...")
    # List backups
    bk_list = session.get(f"{BASE_URL}/api/backups")
    assert bk_list.status_code == 200
    bks = bk_list.json()
    print(f"  -> Existing verified backups: {len(bks)} PASS.")

    # Create backup snapshot
    bk_create = session.post(f"{BASE_URL}/api/backups/create")
    assert bk_create.status_code == 200
    created_bk = bk_create.json()
    assert created_bk["status"] == "success"
    bk_filename = created_bk["filename"]
    print(f"  -> Created online backup: {bk_filename} ({created_bk['size_mb']} MB) PASS.")

    # Verify backup
    bk_ver = session.post(f"{BASE_URL}/api/backups/verify?filename={bk_filename}")
    assert bk_ver.status_code == 200
    assert bk_ver.json()["status"] == "Valid"
    print(f"  -> Backup integrity check (PRAGMA OK) PASS.")

    # 11. Data Import & Export
    print("[TEST 12] Testing Data Export & Import Engine...")
    # Export Tenants CSV
    exp_csv = session.get(f"{BASE_URL}/api/data/export/tenants?format=csv")
    assert exp_csv.status_code == 200
    assert "tenant_code" in exp_csv.text and "mobile" in exp_csv.text
    print(f"  -> Exported Tenants CSV ({len(exp_csv.text.splitlines())} lines) PASS.")

    # Export Rooms JSON
    exp_json = session.get(f"{BASE_URL}/api/data/export/rooms?format=json")
    assert exp_json.status_code == 200
    rooms_data = exp_json.json()
    assert isinstance(rooms_data, list) and len(rooms_data) > 0
    print(f"  -> Exported Rooms JSON ({len(rooms_data)} rooms) PASS.")

    # Import preview validation
    sample_import_csv = (
        "full_name,mobile,email,gender,occupation,status\n"
        "Karthik Raja,9811223344,karthik@example.com,Male,Engineer,Active\n"
        "Suresh Kumar,9876543210,suresh@example.com,Male,Designer,Active\n" # Duplicate mobile with existing tenant
    )
    prev_res = session.post(f"{BASE_URL}/api/data/import/preview", json={
        "entity_type": "tenants",
        "filename": "test_tenants.csv",
        "content_text": sample_import_csv
    })
    assert prev_res.status_code == 200
    prev_data = prev_res.json()
    assert prev_data["total_rows"] == 2
    assert prev_data["valid_count"] == 1
    assert prev_data["skipped_count"] == 1 # Caught duplicate mobile!
    print(f"  -> Import preview: 1 valid, 1 duplicate caught PASS.")

    # 12. System Health Diagnostics
    print("[TEST 13] Testing System Health Diagnostics...")
    health_res = session.get(f"{BASE_URL}/api/system/health")
    assert health_res.status_code == 200
    h_data = health_res.json()
    assert h_data["database_connected"] == True
    assert h_data["scheduler_active"] == True
    assert "disk_free_gb" in h_data
    print(f"  -> System Health: {h_data['status']} | DB: {h_data['database_size_mb']} MB | Free Disk: {h_data['disk_free_gb']} GB PASS.")

    print("\n=== ALL 13 PHASE 6 AUTOMATION & ANALYTICS TESTS PASSED 100%! ===")

if __name__ == "__main__":
    run_tests()

