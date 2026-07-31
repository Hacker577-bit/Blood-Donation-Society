import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const errorRate = new Rate("errors");

export const options = {
  stages: [
    { duration: "10s", target: 5 },
    { duration: "20s", target: 10 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    errors: ["rate<0.1"],
    http_req_duration: ["p(95)<30000"],
  },
};

export default function () {
  const donorPayload = {
    name: `Test Donor ${__VU}-${__ITER}`,
    phone: `+92300${String(__VU).padStart(4, "0")}${String(__ITER).padStart(4, "0")}`,
    bloodType: "O_POS",
    areas: ["Gulberg"],
    lastDonationDate: null,
  };

  const registerRes = http.post(
    `${BASE_URL}/api/register`,
    JSON.stringify(donorPayload),
    { headers: { "Content-Type": "application/json" } },
  );

  check(registerRes, {
    "register accepted or rate-limited": (r) =>
      r.status === 200 || r.status === 429,
  });

  if (registerRes.status === 200) {
    errorRate.add(0);
  } else {
    errorRate.add(1);
  }

  const searchPayload = {
    searcherName: `Searcher ${__VU}`,
    searcherPhone: `+92311${String(__VU).padStart(4, "0")}0000`,
    bloodType: "O_POS",
    area: "Gulberg",
  };

  const searchRes = http.post(
    `${BASE_URL}/api/search`,
    JSON.stringify(searchPayload),
    { headers: { "Content-Type": "application/json" } },
  );

  check(searchRes, {
    "search returned or rate-limited": (r) =>
      r.status === 200 || r.status === 429,
  });

  sleep(1);
}
