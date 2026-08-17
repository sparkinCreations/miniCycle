// timestamp-converter.js — extracted from timestamp-converter.html (Aug 2026).
// It was an INLINE script with no CSP hash, so the deployed page served it
// under the site CSP and the browser blocked it: the converter rendered but
// did nothing. External files need no hash.
const timestampInput = document.getElementById('timestamp');
const resultDiv = document.getElementById('result');
const errorDiv = document.getElementById('error');
const fullDateEl = document.getElementById('fullDate');
const dateOnlyEl = document.getElementById('dateOnly');
const timeOnlyEl = document.getElementById('timeOnly');
const relativeTimeEl = document.getElementById('relativeTime');

function convertTimestamp(timestamp) {
  const num = parseInt(timestamp, 10);

  // Validate
  if (isNaN(num)) {
    showError();
    return;
  }

  // Hide error, show result
  errorDiv.classList.remove('show');
  resultDiv.classList.add('show');

  // Convert
  const date = new Date(num);

  // Check if valid date
  if (isNaN(date.getTime())) {
    showError();
    return;
  }

  // Format results
  fullDateEl.textContent = date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  dateOnlyEl.textContent = date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  timeOnlyEl.textContent = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  // Calculate relative time
  const now = new Date();
  const diff = date - now;
  const absDiff = Math.abs(diff);

  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));

  let relativeStr = '';
  if (diff > 0) {
    // Future
    if (days > 0) {
      relativeStr = `In ${days} day${days !== 1 ? 's' : ''} and ${hours} hour${hours !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      relativeStr = `In ${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      relativeStr = `In ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  } else {
    // Past
    if (days > 0) {
      relativeStr = `${days} day${days !== 1 ? 's' : ''} and ${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      relativeStr = `${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      relativeStr = `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else {
      relativeStr = 'Just now';
    }
  }

  relativeTimeEl.textContent = relativeStr;
}

function showError() {
  errorDiv.classList.add('show');
  resultDiv.classList.remove('show');
}

// Auto-convert as user types
timestampInput.addEventListener('input', (e) => {
  const value = e.target.value.trim();
  if (value === '') {
    resultDiv.classList.remove('show');
    errorDiv.classList.remove('show');
    return;
  }
  convertTimestamp(value);
});

// Auto-fill if timestamp in URL query param
const urlParams = new URLSearchParams(window.location.search);
const tsParam = urlParams.get('ts');
if (tsParam) {
  timestampInput.value = tsParam;
  convertTimestamp(tsParam);
}
  
