const { query, queryOne, execute, transaction } = require('../db/database');

/**
 * Get submissions for admin review
 */
function getAdminSubmissions(status = 'all') {
  let sql = `
    SELECT ts.*, t.symbol, t.price, t.listing_status 
    FROM token_submissions ts
    LEFT JOIN tokens t ON ts.token_id = t.id
  `;
  if (status !== 'all') {
    sql += ` WHERE ts.status = ?`;
    return query(sql + ` ORDER BY ts.submitted_at DESC`, [status]);
  }
  return query(sql + ` ORDER BY ts.submitted_at DESC`);
}

/**
 * Admin approves, rejects, or suspends a token submission
 */
function reviewSubmission(adminId, submissionId, action, note = '') {
  return transaction(() => {
    const sub = queryOne(`SELECT * FROM token_submissions WHERE id = ?`, [submissionId]);
    if (!sub) throw new Error('Submission not found.');

    let newSubStatus = 'pending';
    let newListingStatus = 'LIVE';

    if (action === 'approve') {
      newSubStatus = 'approved';
      newListingStatus = 'LIVE';
    } else if (action === 'reject') {
      newSubStatus = 'rejected';
      newListingStatus = 'REJECTED';
    } else if (action === 'suspend') {
      newSubStatus = 'suspended';
      newListingStatus = 'SUSPENDED';
    }

    execute(`
      UPDATE token_submissions 
      SET status = ?, admin_note = ?, reviewed_at = CURRENT_TIMESTAMP, approved_at = ${action === 'approve' ? 'CURRENT_TIMESTAMP' : 'NULL'}
      WHERE id = ?
    `, [newSubStatus, note || `Reviewed by ${adminId}: ${action}`, submissionId]);

    if (sub.token_id) {
      execute(`
        UPDATE tokens SET listing_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `, [newListingStatus, sub.token_id]);
    }

    // Record audit log
    execute(`
      INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, old_value, new_value)
      VALUES (?, ?, 'token_submissions', ?, ?, ?)
    `, [adminId, `SUBMISSION_${action.toUpperCase()}`, submissionId, sub.status, newSubStatus]);

    return { success: true, submissionId, action, status: newSubStatus };
  });
}

/**
 * Get all promotion orders for admin
 */
function getAdminOrders() {
  return query(`
    SELECT po.*, t.name AS token_name, t.symbol AS token_symbol, p.status AS payment_status_db
    FROM promotion_orders po
    LEFT JOIN tokens t ON po.token_id = t.id
    LEFT JOIN payments p ON p.order_id = po.id
    ORDER BY po.created_at DESC
  `);
}

/**
 * Approve and activate a promotion order
 */
function activatePromotionOrder(adminId, orderId) {
  return transaction(() => {
    const order = queryOne(`SELECT * FROM promotion_orders WHERE id = ?`, [orderId]);
    if (!order) throw new Error('Order not found.');

    execute(`
      UPDATE promotion_orders 
      SET order_status = 'active', payment_status = 'completed', approved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [orderId]);

    execute(`UPDATE payments SET status = 'completed', paid_at = CURRENT_TIMESTAMP WHERE order_id = ?`, [orderId]);

    execute(`
      INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, old_value, new_value)
      VALUES (?, 'PROMOTION_ORDER_ACTIVATED', 'promotion_orders', ?, ?, 'active')
    `, [adminId, orderId, order.order_status]);

    return { success: true, orderId };
  });
}

/**
 * Get audit logs
 */
function getAdminLogs(limit = 100) {
  return query(`SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT ?`, [limit]);
}

module.exports = {
  getAdminSubmissions,
  reviewSubmission,
  getAdminOrders,
  activatePromotionOrder,
  getAdminLogs
};
