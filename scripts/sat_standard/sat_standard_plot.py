import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.dates import DateFormatter

import sys

if len(sys.argv) != 2:
    print("Usage: python sat_standard_plot.py <csv_file>")
    sys.exit(1)

# Save result of following query to csv file:
#
# SELECT 
#   DATE_TRUNC('day', created_at) as day,
#   COUNT(id) AS nitems,
#   (SUM(msats) - SUM(mcredits)) / 1000.0 as sats,
#   SUM(mcredits) / 1000.0 as credits,
#   1 - SUM(mcredits)/SUM(msats) AS sat_standard
# FROM "Item"
# WHERE created_at > '2025-01-03'
# GROUP BY DATE_TRUNC('day', created_at)
# ORDER BY day DESC;
#
# query for total sats:
# 
# SELECT 
#  COUNT(id) AS nitems,
#  (SUM(msats) - SUM(mcredits)) / 1000.0 as sats,
#  SUM(mcredits) / 1000.0 as credits,
#  1 - SUM(mcredits)/SUM(msats) AS sat_standard
# FROM "Item"
# WHERE created_at > '2025-01-03';

csv_file = sys.argv[1]

df = pd.read_csv(csv_file)
df['day'] = pd.to_datetime(df['day'])
df['sats'] = pd.to_numeric(df['sats'].str.replace(',', ''))
df['credits'] = pd.to_numeric(df['credits'].str.replace(',', ''))
df = df.sort_values('day')

plt.figure(figsize=(12, 8))

ax1 = plt.gca()
ax2 = ax1.twinx()

ax1.fill_between(df['day'], 0, df['sats'], alpha=0.5, color='orange', label='sats')
ax1.fill_between(df['day'], df['sats'], df['sats'] + df['credits'], alpha=0.5, color='blue', label='credits')
ax1.xaxis.set_major_formatter(DateFormatter('%b %d'))
ax1.set_xlabel('date')
ax1.set_ylabel('sats spent')

ax2.plot(df['day'], df['sat_standard'], color='green', label='sat standard', linestyle='-')
ax2.set_ylim(0, 1)
ax2.set_ylabel('sat standard')

plt.xticks(rotation=45)
plt.title('Sat Standard')

handles1, labels1 = ax1.get_legend_handles_labels()
handles2, labels2 = ax2.get_legend_handles_labels()
ax1.legend(handles1 + handles2, labels1 + labels2, loc='upper left')

# Adjust layout to prevent label cutoff
plt.tight_layout()

plt.show()
plt.savefig('sat_standard.png')