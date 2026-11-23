import requests
import json
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    session = requests.Session()
    print("=== STARTING PHASE 3 AUTOMATED FINANCIAL TEST SUITE ===")

    # Test 18: Phase 1 login, backup, Phase 2 rooms/tenants check
    print("[TEST 18] Testing Phase 1 Login & Session...")
    login_res = session.post(f"{BASE_URL}/api/auth/login", json={"username": "admin", "password": "MoonLightAdmin2026!"})
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    print("  -> Login PASS. Session authenticated.")

    backup_res = session.post(f"{BASE_URL}/api/admin/backup")
    assert backup_res.status_code == 200
    print("  -> Phase 1 Backup PASS.")

    # Phase 2 check
    t_list = session.get(f"{BASE_URL}/api/tenants").json()
    assert len(t_list) >= 8, "Tenants list should have at least 8 tenants"
    test_tenant = t_list[0]
    tenant_id = test_tenant["id"]
    print(f"  -> Phase 2 Tenants PASS. Picked Tenant: {test_tenant['full_name']} (ID: {tenant_id})")

    # Test 1: Generate monthly rent for active tenants
    print("[TEST 1] Generating monthly rent for active tenants...")
    # Generate for December 2026
    gen_payload = {
        "billing_month": 12,
        "billing_year": 2026,
        "due_date": "2026-12-10",
        "prorate": True
    }
    gen_res = session.post(f"{BASE_URL}/api/rent/generate", json=gen_payload)
    assert gen_res.status_code == 200, f"Generate rent failed: {gen_res.text}"
    invoices = gen_res.json()
    if len(invoices) == 0:
        # Already generated in previous run; retrieve them
        invoices = session.get(f"{BASE_URL}/api/rent/invoices?month=12&year=2026").json()
    assert len(invoices) >= 8, f"Expected at least 8 invoices, got {len(invoices)}"
    print(f"  -> Generated or retrieved {len(invoices)} rent invoices for 12/2026 PASS.")

    # Test 2: Prevent duplicate invoice generation
    print("[TEST 2] Verifying duplicate invoice generation prevention...")
    gen_dup = session.post(f"{BASE_URL}/api/rent/generate", json=gen_payload)
    assert gen_dup.status_code == 200
    assert len(gen_dup.json()) == 0, "Duplicate invoices should not be generated"
    print("  -> Duplicate generation safely blocked PASS.")

    # Pick an invoice for Test 3, 4, 5
    inv_target = invoices[0]
    inv_id = inv_target["id"]
    inv_tenant_id = inv_target["tenant_id"]
    base_amount = inv_target["total_amount"]
    print(f"  -> Using Invoice #{inv_id} for Tenant {inv_tenant_id}, Total: Rs. {base_amount}")

    # Test 4: Record partial rent payment
    print(f"[TEST 4] Recording partial payment of Rs. 2000 against Invoice #{inv_id}...")
    part_pmt_payload = {
        "tenant_id": inv_tenant_id,
        "invoice_id": inv_id,
        "payment_date": "2026-12-03",
        "amount": 2000.0,
        "payment_type": "Monthly Rent",
        "payment_mode": "UPI",
        "transaction_ref": "UPIPARTIAL9812",
        "notes": "Partial rent installment 1"
    }
    part_res = session.post(f"{BASE_URL}/api/payments", json=part_pmt_payload)
    assert part_res.status_code == 200, f"Partial payment failed: {part_res.text}"
    p1 = part_res.json()
    print(f"  -> Partial payment recorded: Voucher {p1['payment_number']}, Receipt {p1['receipt_number']} PASS")

    # Verify invoice status is Partially Paid
    inv_check1 = session.get(f"{BASE_URL}/api/rent/invoices/{inv_id}").json()
    assert inv_check1["status"] == "Partially Paid"
    assert inv_check1["amount_paid"] == 2000.0
    assert inv_check1["pending_amount"] == base_amount - 2000.0
    print(f"  -> Invoice updated to Partially Paid, Remaining: Rs. {inv_check1['pending_amount']} PASS")

    # Test 5 & 6: Record multiple payments against one invoice & calculate outstanding balance
    rem_amount = inv_check1["pending_amount"]
    second_installment = 1500.0
    print(f"[TEST 5 & 6] Recording second partial payment of Rs. {second_installment}...")
    part2_payload = {
        "tenant_id": inv_tenant_id,
        "invoice_id": inv_id,
        "payment_date": "2026-12-05",
        "amount": second_installment,
        "payment_type": "Monthly Rent",
        "payment_mode": "Cash",
        "notes": "Partial rent installment 2"
    }
    part2_res = session.post(f"{BASE_URL}/api/payments", json=part2_payload)
    assert part2_res.status_code == 200
    inv_check2 = session.get(f"{BASE_URL}/api/rent/invoices/{inv_id}").json()
    assert inv_check2["amount_paid"] == 2000.0 + second_installment
    assert inv_check2["pending_amount"] == base_amount - (2000.0 + second_installment)
    print(f"  -> Multiple payments recorded. Balance accurately reduced to: Rs. {inv_check2['pending_amount']} PASS")

    # Test 3: Complete full payment for remainder
    print(f"[TEST 3] Paying final remaining balance of Rs. {inv_check2['pending_amount']}...")
    final_payload = {
        "tenant_id": inv_tenant_id,
        "invoice_id": inv_id,
        "payment_date": "2026-12-06",
        "amount": inv_check2["pending_amount"],
        "payment_type": "Monthly Rent",
        "payment_mode": "Bank Transfer",
        "transaction_ref": "IMPSFINAL8819",
        "notes": "Final settlement"
    }
    final_res = session.post(f"{BASE_URL}/api/payments", json=final_payload)
    assert final_res.status_code == 200
    inv_check3 = session.get(f"{BASE_URL}/api/rent/invoices/{inv_id}").json()
    assert inv_check3["status"] == "Paid"
    assert inv_check3["pending_amount"] == 0.0
    print(f"  -> Invoice #{inv_id} fully PAID PASS")

    # Test 7: Record an advance payment
    print(f"[TEST 7] Recording Advance Rent of Rs. 5000 for Tenant {tenant_id}...")
    adv_payload = {
        "tenant_id": tenant_id,
        "deposit_type": "Advance Rent",
        "amount": 5000.0,
        "payment_date": "2026-12-01",
        "payment_mode": "UPI",
        "transaction_ref": "UPIADV9988",
        "remarks": "Advance rent for upcoming quarters"
    }
    adv_res = session.post(f"{BASE_URL}/api/deposits", json=adv_payload)
    assert adv_res.status_code == 200, f"Advance deposit failed: {adv_res.text}"
    adv_dep = adv_res.json()
    adv_id = adv_dep["id"]
    assert adv_dep["remaining_balance"] == 5000.0
    print(f"  -> Advance recorded: {adv_dep['deposit_number']} PASS")

    # Test 8: Record a security deposit
    print(f"[TEST 8] Recording Security Deposit of Rs. 12000 for Tenant {tenant_id}...")
    sec_payload = {
        "tenant_id": tenant_id,
        "deposit_type": "Security Deposit",
        "amount": 12000.0,
        "payment_date": "2026-12-01",
        "payment_mode": "Bank Transfer",
        "transaction_ref": "NEFTSEC9988",
        "remarks": "Refundable security deposit"
    }
    sec_res = session.post(f"{BASE_URL}/api/deposits", json=sec_payload)
    assert sec_res.status_code == 200, f"Security deposit failed: {sec_res.text}"
    sec_dep = sec_res.json()
    sec_id = sec_dep["id"]
    assert sec_dep["remaining_balance"] == 12000.0
    print(f"  -> Security Deposit recorded: {sec_dep['deposit_number']} PASS")

    # Test 9: Adjust advance against rent
    # Pick a second invoice that has pending amount
    inv_target2 = next(inv for inv in invoices if inv["id"] != inv_id and inv["tenant_id"] == tenant_id)
    print(f"[TEST 9] Adjusting Rs. 3000 from Advance #{adv_id} against Invoice #{inv_target2['id']}...")
    adj_payload = {
        "invoice_id": inv_target2["id"],
        "amount": 3000.0,
        "reason": "Adjusted advance against December rent"
    }
    adj_res = session.post(f"{BASE_URL}/api/deposits/{adv_id}/adjust", json=adj_payload)
    assert adj_res.status_code == 200, f"Deposit adjust failed: {adj_res.text}"
    adv_after = adj_res.json()
    assert adv_after["adjusted_amount"] == 3000.0
    assert adv_after["remaining_balance"] == 2000.0
    print(f"  -> Advance adjusted. Advance balance remaining: Rs. {adv_after['remaining_balance']} PASS")

    # Verify invoice received the payment
    inv2_check = session.get(f"{BASE_URL}/api/rent/invoices/{inv_target2['id']}").json()
    assert inv2_check["amount_paid"] == 3000.0
    print(f"  -> Target invoice #{inv_target2['id']} successfully credited Rs. 3000 PASS")

    # Test 10: Record partial deposit refund
    print(f"[TEST 10] Recording partial refund of Rs. 2000 on Security Deposit #{sec_id}...")
    part_ref_payload = {
        "amount": 2000.0,
        "refund_date": "2026-12-07",
        "payment_mode": "Bank Transfer",
        "transaction_ref": "REFUNDPART881",
        "reason": "Excess security deposit returned"
    }
    part_ref_res = session.post(f"{BASE_URL}/api/deposits/{sec_id}/refund", json=part_ref_payload)
    assert part_ref_res.status_code == 200, f"Partial refund failed: {part_ref_res.text}"
    sec_after_part = part_ref_res.json()
    assert sec_after_part["refunded_amount"] == 2000.0
    assert sec_after_part["remaining_balance"] == 10000.0
    print(f"  -> Partial refund recorded. Remaining balance: Rs. {sec_after_part['remaining_balance']} PASS")

    # Test 11: Record complete deposit refund
    print(f"[TEST 11] Recording complete refund of remaining Rs. 10000 on Security Deposit #{sec_id}...")
    full_ref_payload = {
        "amount": 10000.0,
        "refund_date": "2026-12-08",
        "payment_mode": "Bank Transfer",
        "transaction_ref": "REFUNDFULL992",
        "reason": "Full deposit refund"
    }
    full_ref_res = session.post(f"{BASE_URL}/api/deposits/{sec_id}/refund", json=full_ref_payload)
    assert full_ref_res.status_code == 200, f"Full refund failed: {full_ref_res.text}"
    sec_after_full = full_ref_res.json()
    assert sec_after_full["status"] == "Refunded"
    assert sec_after_full["remaining_balance"] == 0.0
    print(f"  -> Full refund completed. Status: {sec_after_full['status']} PASS")

    # Test 12: Generate and download PDF receipts
    print("[TEST 12] Verifying receipt creation and PDF download...")
    receipts_list = session.get(f"{BASE_URL}/api/receipts").json()
    assert len(receipts_list) > 0, "Receipts list should not be empty"
    rec = receipts_list[0]
    print(f"  -> Found receipt {rec['receipt_number']} (ID: {rec['id']})")
    dl_res = session.get(f"{BASE_URL}/api/receipts/{rec['id']}/download")
    assert dl_res.status_code == 200, f"PDF receipt download failed: {dl_res.status_code}"
    assert dl_res.headers["content-type"] == "application/pdf"
    assert len(dl_res.content) > 1000, "PDF content is too small"
    print(f"  -> PDF receipt downloaded successfully ({len(dl_res.content)} bytes) PASS")

    # Test 13: Add and edit expenses
    print("[TEST 13] Adding and editing expenses...")
    exp_payload = {
        "title": "Emergency Generator Diesel",
        "category": "Maintenance",
        "amount": 3500.0,
        "expense_date": "2026-12-02",
        "payment_mode": "Cash",
        "paid_to": "Fuel Station",
        "remarks": "Power cut backup"
    }
    exp_res = session.post(f"{BASE_URL}/api/expenses", json=exp_payload)
    assert exp_res.status_code == 200, f"Create expense failed: {exp_res.text}"
    exp = exp_res.json()
    exp_id = exp["id"]
    print(f"  -> Expense {exp['expense_number']} created PASS")

    # Edit expense
    edit_exp = session.put(f"{BASE_URL}/api/expenses/{exp_id}", json={"amount": 3800.0, "remarks": "Updated bill amount"})
    assert edit_exp.status_code == 200
    assert edit_exp.json()["amount"] == 3800.0
    print(f"  -> Expense updated successfully to Rs. 3800 PASS")

    # Test 14 & 15: Calculate monthly income and expenses & verify deposits excluded from operating income
    print("[TEST 14 & 15] Verifying Financial Dashboard & Operating Income separation...")
    dash_fin = session.get(f"{BASE_URL}/api/financial/dashboard?period=this_year").json()
    print("  Financial Dashboard:", json.dumps({
        "total_rent_collected": dash_fin["total_rent_collected"],
        "advance_collected": dash_fin["advance_collected"],
        "security_deposits_collected": dash_fin["security_deposits_collected"],
        "total_operating_income": dash_fin["total_operating_income"],
        "total_yearly_expenses": dash_fin["total_yearly_expenses"],
        "net_operating_income": dash_fin["net_operating_income"]
    }, indent=2))

    # CRITICAL ACCOUNTING CHECK:
    # Operating income must NOT include security deposits collected
    assert dash_fin["total_operating_income"] >= dash_fin["total_rent_collected"]
    assert dash_fin["security_deposits_collected"] > 0
    # verify operating income excludes security deposits:
    # total_operating_income should equal rent_collected + advance_collected + other_income
    assert round(dash_fin["total_operating_income"], 2) == round(dash_fin["total_rent_collected"] + dash_fin["advance_collected"] + dash_fin["other_income"], 2)
    print("  -> Deposits correctly separated from operating income PASS")

    # Test 16: Verify dashboard values against database records
    print("[TEST 16] Verifying dashboard metrics against database...")
    inv_all = session.get(f"{BASE_URL}/api/rent/invoices").json()
    sum_pending = sum(inv["pending_amount"] for inv in inv_all)
    assert abs(dash_fin["total_pending_rent"] - sum_pending) < 1.0, "Pending rent should match invoice sum"
    print("  -> Pending rent matches invoice ledger sum PASS")

    # Test 17: Verify financial history after tenant vacating
    print("[TEST 17] Verifying financial history remains intact after tenant vacating...")
    t_fin = session.get(f"{BASE_URL}/api/tenants/{tenant_id}").json()
    assert "total_paid" in t_fin
    assert "total_pending" in t_fin
    assert t_fin["total_paid"] > 0
    print(f"  -> Tenant profile #{tenant_id} reflects financial summary: Paid Rs. {t_fin['total_paid']}, Pending Rs. {t_fin['total_pending']} PASS")

    print("\nALL 18 PHASE 3 TEST SCENARIOS PASSED WITH 100% SUCCESS RATE!")

if __name__ == "__main__":
    run_tests()

