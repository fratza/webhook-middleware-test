const axios = require('axios');

// XML data from the example
const xmlData = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:ev="http://purl.org/rss/1.0/modules/event/" xmlns:s="http://sidearmsports.com/schemas/cal_rss/1.0/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
<title>Ole Miss Athletics</title>
<link>https://olemisssports.com</link>
<atom:link rel="self" href="https://olemisssports.com/calendar.ashx/calendar.rss" />
<description></description>
<item>
<title>5/18 6:30 PM [L] Ole Miss Softball vs Arizona</title>
<description>[L] Ole Miss Softball vs Arizona\nL 1-10 (F/5)\nTV: ESPN+\nStreaming Video: https://www.espn.com/watch/player/_/id/1adc6b21-b195-4748-94e8-dfdea6e16321\nTickets: https://arizonawildcats.evenue.net/events/SBR\n https://olemisssports.com/calendar.aspx?game_id=14445&amp;amp;sport_id=8</description>
<link>https://olemisssports.com/calendar.aspx?game_id=14445&amp;sport_id=8</link>
<guid isPermaLink="true">https://olemisssports.com/calendar.aspx?game_id=14445&amp;sport_id=8</guid>
<ev:location>Tucson, Ariz.</ev:location>
<ev:startdate>2025-05-18T23:30:00.0000000Z</ev:startdate>
<ev:enddate>2025-05-19T01:30:00.0000000Z</ev:enddate>
<s:localstartdate>2025-05-18T18:30:00.0000000</s:localstartdate>
<s:localenddate>2025-05-18T20:30:00.0000000</s:localenddate>
<s:teamlogo>https://olemisssports.com/images/logos/site/site.png</s:teamlogo>
<s:opponentlogo>https://olemisssports.com/images/logos/arizona_.png</s:opponentlogo>
<s:opponent>Arizona</s:opponent>
<s:gameid>14445</s:gameid>
<s:gamepromoname></s:gamepromoname>
<s:links>
<s:livestats>https://www.ncaa.com/game/6449258</s:livestats>
<s:boxscore>https://olemisssports.com/boxscore.aspx?id=14445</s:boxscore>
<s:recap>https://olemisssports.com//news/2025/5/18/no-17-softball-eliminates-no-13-arizona-advances-to-super-regionals</s:recap>
</s:links>
</item>
</channel>
</rss>`;

// Function to test the XML parsing endpoint
async function testXMLEndpoint() {
  try {
    console.log('Testing XML parsing endpoint...');
    
    // Send the XML data to the endpoint
    const response = await axios.post('http://localhost:3000/api/webhook/xmlparser', xmlData, {
      headers: {
        'Content-Type': 'text/xml'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response metadata:', JSON.stringify(response.data.meta, null, 2));
    console.log('Number of items:', response.data.data.length);
    
    // Print each item's key fields
    response.data.data.forEach((item, index) => {
      console.log(`\nItem ${index + 1}:`);
      console.log('  Title:', item.title);
      console.log('  Score:', item.score);
      console.log('  Local Start Date/Time:', item.localStartDateTime);
      console.log('  Opponent Logo:', item.opponentLogo);
      console.log('  Location:', item.location);
      console.log('  Opponent:', item.opponent);
    });
    
    // Print full data for detailed inspection
    console.log('\nFull response data:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error testing XML endpoint:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testXMLEndpoint();
