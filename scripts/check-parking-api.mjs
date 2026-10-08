import {createParkingService} from '../services/parkingService.js';

// node scripts/check-parking-api.mjs 화명 http://localhost:8788/api/parking
const keyword = process.argv[2] ?? '화명';
const apiUrl = process.argv[3] ?? process.env.PARKING_API_URL ?? 'http://localhost:8788/api/parking';
try {
  const result = await createParkingService({apiUrl}).searchParking({keyword, limit: 10});
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`${error.code ?? 'ERROR'}: ${error.message}`);
  process.exitCode = 1;
}
