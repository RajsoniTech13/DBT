/**
 * Utility to export JSON data to CSV and trigger a browser download.
 */
export const exportToCSV = (data: any[], filename: string) => {
  if (!data || !data.length) {
    alert("No data to export");
    return;
  }

  // 1. Get headers
  const headers = Object.keys(data[0]);
  
  // 2. Map data rows
  const csvRows = data.map(row => {
    return headers.map(header => {
      const val = row[header];
      // Escape quotes and wrap in quotes if contains comma
      const escaped = String(val).replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',');
  });

  // 3. Combine headers and rows
  const csvContent = [headers.join(','), ...csvRows].join('\n');

  // 4. Create Blob and Trigger Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
