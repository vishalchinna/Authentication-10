const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const intilizeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server started");
    });
  } catch (e) {
    console.log(`Error : ${e.message}`);
    process.exit(1);
  }
};

intilizeDbAndServer();

const authentication = async (request, response, next) => {
  let jwtToken;
  const authHead = request.header("authorization");
  if (authHead !== undefined) {
    jwtToken = authHead.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "my_key", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userQuery = `
  SELECT * FROM user 
  WHERE username = '${username}'
  `;
  const userDetails = await db.get(userQuery);
  if (userDetails === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    isMatched = await bcrypt.compare(password, userDetails.password);
    if (isMatched) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "my_key");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/", authentication, async (request, response) => {
  const stateQuery = `
    SELECT 
    state_id as stateId,
    state_name as stateName,
    population
    FROM state
    `;
  const stateArray = await db.all(stateQuery);
  response.send(stateArray);
});

app.get("/states/:stateId/", authentication, async (request, response) => {
  const { stateId } = request.params;
  const stateQuery = `
    SELECT 
    state_id as stateId,
    state_name as stateName,
    population FROM state
    WHERE state_id = ${stateId}
    `;
  const stateArray = await db.get(stateQuery);
  response.send(stateArray);
});

app.post("/districts/", authentication, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createQuery = `
  INSERT INTO district(district_name, 
    state_id,
    cases,
    cured,
    active,
    deaths
    )
    VALUES(
        '${districtName}',
        ${stateId},
        '${cases}',
        '${cured}',
        '${active}',
        '${deaths}'
    )
  `;
  await db.run(createQuery);
  response.send("District Successfully Added");
});

//API 5
app.get(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const districtQuery = `
    SELECT district_id as districtId,
    district_name as districtName,
    state_id as stateId,
    cases,
    cured,
    active,
    deaths
    FROM district
    WHERE district_id = ${districtId}
    `;
    const data = await db.get(districtQuery);
    response.send(data);
  }
);

// API 6
app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `
    DELETE from district
    WHERE district_id = ${districtId}
    `;
    await db.run(deleteQuery);
    response.send("District Removed");
  }
);

//API 7
app.put(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateQuery = `
   UPDATE district SET
   district_name = '${districtName}',
   state_id = ${stateId},
   cases = '${cases}',
   cured = '${cured}',
   active = '${active}',
   deaths = '${deaths}'
   `;
    await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
    SELECT
      SUM(cases),
      SUM(cured),
      SUM(active),
      SUM(deaths)
    FROM
      district
    WHERE
      state_id=${stateId};`;
    const stats = await db.get(getStateStatsQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

//ccbp submit NJSCPIKNGV
module.exports = app;
