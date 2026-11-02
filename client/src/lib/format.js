export function formatUsd(usd) {
  if (usd === null || usd === undefined) {
    return 'not reported';
  }
  if (usd === 0) {
    return '$0.00';
  }
  if (usd < 0.01) {
    return '$' + usd.toFixed(4);
  }
  if (usd < 1) {
    return '$' + usd.toFixed(3);
  }
  return '$' + usd.toFixed(2);
}

export function formatMs(ms) {
  if (ms === null || ms === undefined) {
    return '—';
  }
  if (ms < 1000) {
    return ms + ' ms';
  }
  if (ms < 60000) {
    const seconds = ms / 1000;
    // Use one decimal place
    return seconds.toFixed(1) + ' s';
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return minutes + ' min ' + seconds + ' s';
}

export function formatTokens(n) {
  return n.toLocaleString('en-GB');
}

export function summariseReceipts(receipts) {
  if (!Array.isArray(receipts) || receipts.length === 0) {
    return { steps: 0, toolCalls: 0, failed: 0, totalMs: 0, costUsd: 0, costComplete: true, models: [] };
  }
  const steps = receipts.length;
  let toolCalls = 0;
  let failed = 0;
  let totalMs = 0;
  let costUsdSum = 0;
  let costComplete = true;
  const modelsSet = new Set();
  const models = [];

  for (const receipt of receipts) {
    if (Array.isArray(receipt.toolCalls)) {
      toolCalls += receipt.toolCalls.length;
    }
    if (receipt.error) {
      failed++;
    }
    if (typeof receipt.totalMs === 'number') {
      totalMs += receipt.totalMs;
    }
    if (receipt.costUsd === null) {
      costComplete = false;
    } else if (typeof receipt.costUsd === 'number') {
      costUsdSum += receipt.costUsd;
    }
    if (receipt.model && !modelsSet.has(receipt.model)) {
      modelsSet.add(receipt.model);
      models.push(receipt.model);
    }
  }

  const costUsd = Math.round(costUsdSum * 1e6) / 1e6;
  return { steps, toolCalls, failed, totalMs, costUsd, costComplete, models };
}
