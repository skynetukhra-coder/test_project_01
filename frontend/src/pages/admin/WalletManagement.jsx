import React, { useState, useEffect } from "react";
import {
    FaSearch,
    FaWallet,
    FaPlus,
    FaHistory,
    FaExclamationTriangle,
    FaShieldAlt,
    FaDownload,
    FaCheck,
    FaTimes,
    FaQrcode
} from "react-icons/fa";
import "./WalletManagement.css";
import axios from "axios";

const API_BASE = (window.API_BASE_URL || "http://localhost:5000") + "/api/wallet";

function WalletManagement() {
    const [employees, setEmployees] = useState([]);
    const [recharges, setRecharges] = useState([]);
    const [userRecharges, setUserRecharges] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [rechargeToday, setRechargeToday] = useState(0);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // Modal control
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEmp, setSelectedEmp] = useState(null);
    const [modifyType, setModifyType] = useState("RECHARGE"); // RECHARGE or DEDUCT
    const [amount, setAmount] = useState("");
    const [adminPassword, setAdminPassword] = useState("");
    const [pendingTxId, setPendingTxId] = useState(null);
    const [isAutoFilled, setIsAutoFilled] = useState(false);

    // Get current logged in admin
    const adminUser = JSON.parse(localStorage.getItem("user")) || {};

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [listRes, rechargesRes, userRechargesRes, statsRes] = await Promise.all([
                axios.get(`${API_BASE}/list`),
                axios.get(`${API_BASE}/recharges`),
                axios.get(`${API_BASE}/user-recharges`),
                axios.get(`${API_BASE}/stats`)
            ]);
            setEmployees(listRes.data || []);
            setRecharges(rechargesRes.data || []);
            setUserRecharges(userRechargesRes.data || []);
            setRechargeToday(statsRes.data.todayRecharges || 0);
        } catch (err) {
            console.error("Error fetching wallet data:", err);
        }
    };

    const handleOpenModal = (emp, type) => {
        setSelectedEmp(emp);
        setModifyType(type);
        setAmount("");
        setAdminPassword("");
        setPendingTxId(null);
        setIsAutoFilled(false);
        setIsModalOpen(true);
    };

    const handleOpenApproveModal = (uRecharge) => {
        const emp = employees.find(e => e.employee_id === uRecharge.employee_id) || {
            employee_id: uRecharge.employee_id,
            full_name: uRecharge.employee_name,
            username: uRecharge.employee_code
        };
        setSelectedEmp(emp);
        setModifyType("RECHARGE");
        setAmount(uRecharge.amount);
        setPendingTxId(uRecharge.transaction_id);
        setIsAutoFilled(true);
        setAdminPassword("");
        setIsModalOpen(true);
    };

    const handleModifySubmit = async (e) => {
        e.preventDefault();
        if (!selectedEmp || !amount || !adminPassword) {
            alert("Please fill in all required fields.");
            return;
        }

        const amtVal = parseFloat(amount);
        if (isNaN(amtVal) || amtVal <= 0) {
            alert("Please enter a valid positive amount.");
            return;
        }

        try {
            if (pendingTxId) {
                // Approving a user self-service recharge
                const res = await axios.post(`${API_BASE}/approve-user-recharge`, {
                    transaction_id: pendingTxId,
                    admin_id: adminUser.employee_id,
                    admin_password: adminPassword
                });
                alert(res.data.message || "User wallet recharge approved successfully!");
            } else {
                // Direct manual recharge / deduction
                const signedAmount = modifyType === "RECHARGE" ? amtVal : -amtVal;
                const res = await axios.post(`${API_BASE}/modify`, {
                    employee_id: selectedEmp.employee_id,
                    amount: signedAmount,
                    admin_id: adminUser.employee_id,
                    admin_password: adminPassword
                });
                alert(res.data.message || "Wallet modified successfully!");
            }

            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || "Operation failed. Please check admin password.");
        }
    };

    const handleCancelUserRecharge = async (transactionId, empName) => {
        if (!window.confirm(`Are you sure you want to cancel the wallet recharge request for ${empName}?`)) {
            return;
        }

        try {
            const res = await axios.post(`${API_BASE}/cancel-user-recharge`, {
                transaction_id: transactionId
            });
            alert(res.data.message || "Wallet recharge request cancelled.");
            fetchData();
        } catch (err) {
            console.error("Cancel recharge error:", err);
            alert(err.response?.data?.message || "Failed to cancel recharge request.");
        }
    };

    const handleVerifyAll = async () => {
        try {
            const res = await axios.post(`${API_BASE}/verify-all`);
            alert(`Integrity Scan Complete!\nTotal wallets checked: ${res.data.total_checked}\nDiscrepancies found: ${res.data.tampered_count}`);
            fetchData();
        } catch (err) {
            alert("Verification scan failed.");
        }
    };

    const filteredEmployees = employees.filter(
        (emp) =>
            emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalWalletBalance = employees.reduce((sum, emp) => sum + parseFloat(emp.balance), 0);
    const hasTamperedWallets = employees.some(emp => emp.is_tampered);

    const handleReset = () => {
        setStartDate("");
        setEndDate("");
    };

    const filteredUserRecharges = userRecharges.filter(r => {
        if (!startDate && !endDate) return true;

        const logTime = new Date(r.rawDate).getTime();
        if (startDate) {
            const start = new Date(startDate + "T00:00:00");
            if (logTime < start.getTime()) return false;
        }
        if (endDate) {
            const end = new Date(endDate + "T23:59:59.999");
            if (logTime > end.getTime()) return false;
        }
        return true;
    });

    const totalRechargeSum = filteredUserRecharges
        .filter(r => r.status === "SUCCESS")
        .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

    const printReport = () => {
        const printWindow = window.open("", "_blank");
        printWindow.document.write(`
            <html>
                <head>
                    <title>Wallet Recharges Report</title>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; }
                        h1 { margin-bottom: 5px; color: #2c3e50; }
                        p { margin-top: 0; color: #7f8c8d; font-size: 14px; }
                        .summary-bar { background: #f1f5f9; padding: 10px 15px; border-radius: 6px; margin: 15px 0; font-size: 14px; font-weight: 600; color: #1e293b; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 13px; }
                        th { background-color: #f8f9fa; color: #2c3e50; }
                        tr:nth-child(even) { background-color: #f9f9f9; }
                        .badge-success { color: #15803d; font-weight: bold; }
                        .badge-pending { color: #d97706; font-weight: bold; }
                        .badge-cancelled { color: #dc2626; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <h1>Canteen Wallet Recharges Report</h1>
                    <p>Generated on: ${new Date().toLocaleString()}</p>
                    <p>Date Range: ${startDate || 'Start'} to ${endDate || 'End'}</p>
                    <div class="summary-bar">
                        Total Records: ${filteredUserRecharges.length} &nbsp;|&nbsp; 
                        Total Recharged Amount: ₹${totalRechargeSum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Date & Time</th>
                                <th>Employee ID</th>
                                <th>Employee Name</th>
                                <th>Amount (₹)</th>
                                <th>Method</th>
                                <th>Transaction / UTR ID</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredUserRecharges.length === 0 ? `
                                <tr>
                                    <td colspan="7" style="text-align: center; color: #888; padding: 20px;">
                                        No recharge transactions found for the selected date range.
                                    </td>
                                </tr>
                            ` : filteredUserRecharges.map(r => `
                                <tr>
                                    <td>${r.time}</td>
                                    <td>${r.employee_code}</td>
                                    <td>${r.employee_name}</td>
                                    <td>₹${parseFloat(r.amount).toFixed(2)}</td>
                                    <td>${r.payment_method}</td>
                                    <td>${r.utr_number}</td>
                                    <td>
                                        <span class="${r.status === 'SUCCESS' ? 'badge-success' : r.status === 'PENDING' ? 'badge-pending' : 'badge-cancelled'}">
                                            ${r.status === 'SUCCESS' ? 'RECHARGED' : r.status}
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <script>
                        window.onload = function() {
                            window.print();
                            window.close();
                        }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const exportToCSV = () => {
        const headers = ["Date & Time", "Employee ID", "Employee Name", "Amount (₹)", "Payment Method", "Transaction / UTR ID", "Status"];
        const rows = filteredUserRecharges.map(r => [
            `"${r.time || ''}"`,
            `"${r.employee_code || ''}"`,
            `"${r.employee_name || ''}"`,
            r.amount,
            `"${r.payment_method || ''}"`,
            `"${r.utr_number || ''}"`,
            `"${r.status === 'SUCCESS' ? 'RECHARGED' : r.status}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `wallet_recharges_${startDate || 'all'}_to_${endDate || 'all'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="wallet-page">
            {/* HEADER CARD */}
            <div className="wallet-header-card">
                <div className="wallet-header-left">
                    <div className="wallet-icon-box">
                        <FaWallet />
                    </div>
                    <div>
                        <h2>Wallet Management</h2>
                        <p>Manage employee canteen wallets, approve self-service UPI/QR recharges, and verify HMAC hashes.</p>
                    </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "15px", alignItems: "flex-end" }}>
                    {/* ROW 1: Date filters, Reset, Print, CSV */}
                    <div className="orders-date-filter-block" style={{ margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
                        <div className="filter-input-group">
                            <label>Start</label>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)} 
                                onClick={(e) => e.target.showPicker()}
                                onFocus={(e) => e.target.showPicker()}
                                style={{ cursor: "pointer" }}
                            />
                        </div>
                        <div className="filter-input-group">
                            <label>End</label>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => setEndDate(e.target.value)} 
                                onClick={(e) => e.target.showPicker()}
                                onFocus={(e) => e.target.showPicker()}
                                style={{ cursor: "pointer" }}
                            />
                        </div>
                        <button className="reset-filter-btn" onClick={handleReset}>
                            Reset
                        </button>
                        <button className="print-report-btn" onClick={printReport}>
                            Print
                        </button>
                        <button className="export-csv-btn" onClick={exportToCSV}>
                            <FaDownload /> CSV
                        </button>
                    </div>

                    {/* ROW 2: Search Input and Run Integrity Scan Button */}
                    <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
                        <div className="wallet-search" style={{ height: "42px", padding: "0 16px", display: "flex", alignItems: "center" }}>
                            <FaSearch />
                            <input
                                type="text"
                                placeholder="Search Employee..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ height: "100%", background: "transparent", border: "none", outline: "none" }}
                            />
                        </div>

                        <button className="verify-btn" onClick={handleVerifyAll} style={{ margin: 0, height: "42px", padding: "0 20px", display: "flex", alignItems: "center", gap: "8px" }}>
                            <FaShieldAlt />
                            Run Integrity Scan
                        </button>
                    </div>
                </div>
            </div>

            {/* TAMPER DETECTED ALERT BANNER */}
            {hasTamperedWallets && (
                <div className="tamper-banner">
                    <FaExclamationTriangle />
                    <span>
                        CRITICAL WARNING: Out-of-band wallet balance tampering has been detected!
                        Discrepancies have been logged automatically in the system audit logs.
                    </span>
                </div>
            )}

            {/* KPI CARDS */}
            <div className="wallet-stats">
                <div className="wallet-stat-card">
                    <FaWallet />
                    <h3>₹{totalWalletBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</h3>
                    <p>Total Wallet Balance</p>
                </div>

                <div className="wallet-stat-card">
                    <FaPlus />
                    <h3>₹{rechargeToday.toLocaleString("en-IN", { minimumFractionDigits: 0 })}</h3>
                    <p>Recharge Today (Dynamic)</p>
                </div>

                <div className="wallet-stat-card">
                    <FaHistory />
                    <h3>{employees.length}</h3>
                    <p>Active Wallets</p>
                </div>
            </div>

            {/* EMPLOYEE TABLE */}
            <div className="wallet-table-card">
                <h2>Employee Canteen Wallets (Database Records)</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Employee Code</th>
                            <th>Name</th>
                            <th>Designation</th>
                            <th>Wallet Balance</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEmployees.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: "center", color: "#666" }}>
                                    No employee wallets found.
                                </td>
                            </tr>
                        ) : (
                            filteredEmployees.map((emp) => (
                                <tr key={emp.employee_id}>
                                    <td>{emp.username}</td>
                                    <td>{emp.full_name}</td>
                                    <td>{emp.designation || "N/A"}</td>
                                    <td>
                                        <strong>₹{parseFloat(emp.balance).toFixed(2)}</strong>
                                        {emp.is_tampered && (
                                            <span className="tamper-badge" title="HMAC Signature Mismatch!">
                                                TAMPERED
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            <button
                                                className="recharge-btn"
                                                onClick={() => handleOpenModal(emp, "RECHARGE")}
                                            >
                                                Recharge
                                            </button>
                                            <button
                                                className="deduct-btn"
                                                onClick={() => handleOpenModal(emp, "DEDUCT")}
                                            >
                                                Deduct
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* REPLACED LINE CHART: USER SELF-SERVICE WALLET RECHARGES PANEL */}
            <div className="user-recharges-card">
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <FaQrcode style={{ fontSize: "22px", color: "#2563eb" }} />
                    <h2 style={{ margin: 0 }}>Wallet Recharges & Self-Service Requests</h2>
                </div>
                <p>Process pending self-service UPI/QR recharge requests and view wallet top-up history.</p>

                <table>
                    <thead>
                        <tr>
                            <th>Date & Time</th>
                            <th>Employee Code</th>
                            <th>Employee Name</th>
                            <th>Amount (₹)</th>
                            <th>Method</th>
                            <th>Transaction / UTR ID</th>
                            <th>Actions / Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUserRecharges.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: "center", color: "#64748b", padding: "20px" }}>
                                    No wallet recharge records found for the selected period.
                                </td>
                            </tr>
                        ) : (
                            filteredUserRecharges.map((r) => (
                                <tr key={r.transaction_id}>
                                    <td>{r.time}</td>
                                    <td><strong>{r.employee_code}</strong></td>
                                    <td>{r.employee_name}</td>
                                    <td>
                                        <strong style={{ color: "#16a34a", fontSize: "15px" }}>
                                            ₹{parseFloat(r.amount).toFixed(2)}
                                        </strong>
                                    </td>
                                    <td>
                                        <span 
                                            className="method-badge upi" 
                                            style={{ 
                                                 background: r.payment_method === "Admin Manual" ? "#eff6ff" : "#f0fdf4", 
                                                color: r.payment_method === "Admin Manual" ? "#2563eb" : "#16a34a", 
                                                padding: "4px 8px", 
                                                borderRadius: "6px", 
                                                fontSize: "12px", 
                                                fontWeight: "600" 
                                            }}
                                        >
                                            {r.payment_method}
                                        </span>
                                    </td>
                                    <td>
                                        <strong style={{ letterSpacing: "0.5px", color: "#1e293b" }}>
                                            {r.utr_number}
                                        </strong>
                                    </td>
                                    <td>
                                        {r.status === "PENDING" ? (
                                            <div style={{ display: "flex", gap: "8px" }}>
                                                <button
                                                    className="approve-user-btn"
                                                    onClick={() => handleOpenApproveModal(r)}
                                                >
                                                    <FaCheck /> Recharge
                                                </button>
                                                <button
                                                    className="cancel-user-btn"
                                                    onClick={() => handleCancelUserRecharge(r.transaction_id, r.employee_name)}
                                                >
                                                    <FaTimes /> Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <span
                                                className={
                                                    r.status === "SUCCESS"
                                                        ? "status-badge-success"
                                                        : "status-badge-cancelled"
                                                }
                                            >
                                                {r.status === "SUCCESS" ? "RECHARGED" : "CANCELLED"}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL: RECHARGE / DEDUCT WALLET BALANCE */}
            {isModalOpen && selectedEmp && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>
                            {pendingTxId 
                                ? "Confirm User UPI Wallet Recharge" 
                                : modifyType === "RECHARGE" ? "Recharge Wallet" : "Deduct Balance"}
                        </h2>
                        <p style={{ margin: "5px 0 20px 0", color: "#4b5563" }}>
                            Target Employee: <strong>{selectedEmp.full_name}</strong> ({selectedEmp.username})
                        </p>
                        <form onSubmit={handleModifySubmit} className="modal-form">
                            <div className="form-field">
                                <label>Recharge Amount (₹)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    placeholder="e.g. 500"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    disabled={isAutoFilled}
                                    style={{
                                        background: isAutoFilled ? "#f1f5f9" : "white",
                                        cursor: isAutoFilled ? "not-allowed" : "text",
                                        fontWeight: isAutoFilled ? "700" : "normal",
                                        color: isAutoFilled ? "#0f172a" : "inherit"
                                    }}
                                />
                                {isAutoFilled && (
                                    <small style={{ color: "#2563eb", marginTop: "4px", display: "block", fontSize: "12px", fontWeight: "500" }}>
                                        🔒 Amount auto-filled from user's UPI payment submission. Locked for verification accuracy.
                                    </small>
                                )}
                            </div>

                            <div className="form-field">
                                <label>Admin Verification PIN/Password</label>
                                <input
                                    type="password"
                                    required
                                    placeholder="Enter your admin password"
                                    value={adminPassword}
                                    onChange={(e) => setAdminPassword(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="cancel-btn"
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="submit-btn" style={{ background: "#16a34a" }}>
                                    {pendingTxId ? "Confirm & Credit Balance" : "Confirm Action"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WalletManagement;