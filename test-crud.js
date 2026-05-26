const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    let bodyStr = '';
    if (body) {
      bodyStr = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch (e) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed,
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(bodyStr);
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING CRUD API TESTS ON LIVE SERVER ---');
  
  const testDate = '2026-05-21';

  // ==========================================
  // 1. TASKS CRUD
  // ==========================================
  console.log('\nTesting TASKS...');
  const taskTitle = `Test Task ${Date.now()}`;
  const taskDue = new Date().toISOString();
  
  // Create
  const createReq = await request('POST', '/api/tasks', { title: taskTitle, due_at: taskDue });
  console.log('POST /api/tasks Status:', createReq.status);
  const task = createReq.body.task;
  if (!task || !task.id) {
    throw new Error('Failed to create task: ' + JSON.stringify(createReq.body));
  }
  console.log('Task Created:', task);

  // List & Verify
  const listReq = await request('GET', '/api/tasks');
  console.log('GET /api/tasks Status:', listReq.status);
  const foundTask = listReq.body.tasks.find(t => t.id === task.id);
  if (!foundTask) {
    throw new Error('Created task not found in list!');
  }
  console.log('Task verified in list.');

  // Update (PATCH)
  const patchReq = await request('PATCH', `/api/tasks/${task.id}`, { done: true });
  console.log('PATCH /api/tasks/:id Status:', patchReq.status);
  if (!patchReq.body.task || patchReq.body.task.done !== true) {
    throw new Error('Failed to mark task as done: ' + JSON.stringify(patchReq.body));
  }
  console.log('Task updated (marked done).');

  // Delete
  const delReq = await request('DELETE', `/api/tasks/${task.id}`);
  console.log('DELETE /api/tasks/:id Status:', delReq.status);
  
  // Verify deleted
  const listReq2 = await request('GET', '/api/tasks');
  const foundTask2 = listReq2.body.tasks.find(t => t.id === task.id);
  if (foundTask2) {
    throw new Error('Task still exists after delete!');
  }
  console.log('Task deletion verified.');


  // ==========================================
  // 2. LEARNINGS CRUD
  // ==========================================
  console.log('\nTesting LEARNINGS...');
  const learningText = `Test Learning ${Date.now()}`;
  
  // Create
  const createLearningReq = await request('POST', '/api/learnings', { text: learningText, date: testDate });
  console.log('POST /api/learnings Status:', createLearningReq.status);
  
  // List & Verify
  const listLearningReq = await request('GET', `/api/learnings?date=${testDate}`);
  console.log('GET /api/learnings Status:', listLearningReq.status);
  const foundLearning = listLearningReq.body.items.find(item => item.text === learningText);
  if (!foundLearning) {
    throw new Error('Created learning not found in list!');
  }
  console.log('Learning Created & Verified in list:', foundLearning);

  // Delete
  const delLearningReq = await request('DELETE', '/api/learnings', { id: foundLearning.id });
  console.log('DELETE /api/learnings Status:', delLearningReq.status);

  // Verify Deleted
  const listLearningReq2 = await request('GET', `/api/learnings?date=${testDate}`);
  const foundLearning2 = listLearningReq2.body.items.find(item => item.text === learningText);
  if (foundLearning2) {
    throw new Error('Learning still exists after delete!');
  }
  console.log('Learning deletion verified.');


  // ==========================================
  // 3. CALENDAR EVENTS CRUD
  // ==========================================
  console.log('\nTesting GOOGLE CALENDAR EVENTS...');
  const eventTitle = `Test Calendar Event ${Date.now()}`;
  const startEvent = `${testDate}T14:00:00+05:30`;
  const endEvent = `${testDate}T15:00:00+05:30`;

  // Create
  const createCalReq = await request('POST', '/api/calendar', {
    title: eventTitle,
    start: startEvent,
    end: endEvent,
    description: 'Automated test description',
    location: 'Test Location'
  });
  console.log('POST /api/calendar Status:', createCalReq.status);
  if (!createCalReq.body.ok) {
    throw new Error('Failed to create calendar event: ' + JSON.stringify(createCalReq.body));
  }
  console.log('Calendar event created successfully.');

  // List & Verify
  const listCalReq = await request('GET', `/api/calendar?date=${testDate}`);
  console.log('GET /api/calendar Status:', listCalReq.status);
  const foundEvent = listCalReq.body.events.find(e => e.title === eventTitle);
  if (!foundEvent) {
    throw new Error('Created calendar event not found in list!');
  }
  console.log('Calendar event verified in list:', foundEvent);

  // Delete
  const delCalReq = await request('DELETE', '/api/calendar', { id: foundEvent.id });
  console.log('DELETE /api/calendar Status:', delCalReq.status);
  if (!delCalReq.body.ok) {
    throw new Error('Failed to delete calendar event: ' + JSON.stringify(delCalReq.body));
  }
  console.log('Calendar event deleted successfully.');

  // Verify Deleted
  const listCalReq2 = await request('GET', `/api/calendar?date=${testDate}`);
  const foundEvent2 = listCalReq2.body.events.find(e => e.title === eventTitle);
  if (foundEvent2) {
    throw new Error('Calendar event still exists after delete!');
  }
  console.log('Calendar event deletion verified.');


  // ==========================================
  // 4. DAILY LOGS CRUD (Food, Spending, Time Blocks, Activities)
  // ==========================================
  console.log('\nTesting DAILY LOGS (Food, Spending, Time Blocks, Activities)...');
  
  // A. FOOD Log
  console.log('- Testing Food Entry...');
  const foodName = `Test Food ${Date.now()}`;
  const createFoodReq = await request('POST', '/api/daily', {
    date: testDate,
    type: 'food',
    data: {
      name: foodName,
      calories: 450,
      protein_g: 30,
      estimated: true,
      cost: 150,
      time: '12:30',
      meal: 'lunch'
    }
  });
  console.log('POST /api/daily (food) Status:', createFoodReq.status);
  const foodEntry = createFoodReq.body.food;
  if (!foodEntry || !foodEntry.id) {
    throw new Error('Failed to log food: ' + JSON.stringify(createFoodReq.body));
  }
  console.log('Food logged:', foodEntry);

  // B. SPENDING Log
  console.log('- Testing Spending Entry...');
  const spendItem = `Test Item ${Date.now()}`;
  const createSpendReq = await request('POST', '/api/daily', {
    date: testDate,
    type: 'spending',
    data: {
      item: spendItem,
      amount: 250,
      category: 'Entertainment',
      time: '15:45'
    }
  });
  console.log('POST /api/daily (spending) Status:', createSpendReq.status);

  // C. TIME BLOCK Log
  console.log('- Testing Time Block Entry...');
  const blockActivity = `Test Time Block ${Date.now()}`;
  const createBlockReq = await request('POST', '/api/daily', {
    date: testDate,
    type: 'time_block',
    data: {
      start: '16:00',
      end: '18:00',
      activity: blockActivity,
      category: 'Deep Work'
    }
  });
  console.log('POST /api/daily (time_block) Status:', createBlockReq.status);
  const blockEntry = createBlockReq.body.time_block;
  if (!blockEntry || !blockEntry.id) {
    throw new Error('Failed to log time block: ' + JSON.stringify(createBlockReq.body));
  }
  console.log('Time Block logged:', blockEntry);

  // D. ACTIVITY Log
  console.log('- Testing Activity Entry...');
  const activityBody = `Test Activity Note ${Date.now()}`;
  const createActivityReq = await request('POST', '/api/daily', {
    date: testDate,
    type: 'activity',
    data: {
      body: activityBody,
      actor: 'user',
      kind: 'note',
      verb: 'logged',
      time: '18:30'
    }
  });
  console.log('POST /api/daily (activity) Status:', createActivityReq.status);
  const activityEntry = createActivityReq.body.activity;
  if (!activityEntry || !activityEntry.id) {
    throw new Error('Failed to log activity: ' + JSON.stringify(createActivityReq.body));
  }
  console.log('Activity logged:', activityEntry);

  // Fetch Daily & Verify everything is present
  const dailyReq = await request('GET', `/api/daily?date=${testDate}`);
  console.log('GET /api/daily Status:', dailyReq.status);
  
  const foundFood = dailyReq.body.food.find(f => f.id === foodEntry.id);
  const foundSpend = dailyReq.body.spending.find(s => s.item === spendItem);
  const foundBlock = dailyReq.body.time_blocks.find(tb => tb.id === blockEntry.id);
  const foundActivity = dailyReq.body.activities.find(a => a.id === activityEntry.id);

  if (!foundFood) throw new Error('Logged food not found in daily response!');
  if (!foundSpend) throw new Error('Logged spend not found in daily response!');
  if (!foundBlock) throw new Error('Logged time block not found in daily response!');
  if (!foundActivity) throw new Error('Logged activity not found in daily response!');
  console.log('All logged daily entries verified in snapshot successfully.');

  // Clean up / Delete daily entries
  console.log('Cleaning up daily entries...');

  // Delete food
  const delFoodReq = await request('DELETE', '/api/daily', { date: testDate, type: 'food', id: foodEntry.id });
  console.log('DELETE /api/daily (food) Status:', delFoodReq.status);

  // Delete time_block
  const delBlockReq = await request('DELETE', '/api/daily', { date: testDate, type: 'time_block', id: blockEntry.id });
  console.log('DELETE /api/daily (time_block) Status:', delBlockReq.status);

  // Delete spending (uses id)
  const delSpendReq = await request('DELETE', '/api/daily', { date: testDate, type: 'spending', id: foundSpend.id });
  console.log('DELETE /api/daily (spending) Status:', delSpendReq.status);

  // Delete activity
  const delActivityReq = await request('DELETE', '/api/activities', { id: activityEntry.id });
  console.log('DELETE /api/activities Status:', delActivityReq.status);

  // Verify daily snapshot is clear of our test entries
  const checkDaily2 = await request('GET', `/api/daily?date=${testDate}`);
  const foundFood2 = checkDaily2.body.food.find(f => f.id === foodEntry.id);
  const foundSpend2 = checkDaily2.body.spending.find(s => s.item === spendItem);
  const foundBlock2 = checkDaily2.body.time_blocks.find(tb => tb.id === blockEntry.id);
  const foundActivity2 = checkDaily2.body.activities.find(a => a.id === activityEntry.id);

  if (foundFood2) throw new Error('Food entry still exists after delete!');
  if (foundSpend2) throw new Error('Spending entry still exists after delete!');
  if (foundBlock2) throw new Error('Time block entry still exists after delete!');
  if (foundActivity2) throw new Error('Activity entry still exists after delete!');
  console.log('All daily logs CRUD operations verified and cleaned up successfully.');


  // ==========================================
  // 5. WORKOUTS CRUD
  // ==========================================
  console.log('\nTesting WORKOUTS...');
  
  // Create
  const workoutData = {
    date: testDate,
    exercises: [
      {
        name: 'Automated Test Bench Press',
        sets: [
          { reps: 10, weight_kg: 80 },
          { reps: 8, weight_kg: 90 }
        ],
        notes: 'Test notes'
      }
    ]
  };

  const createWorkoutReq = await request('POST', '/api/workouts', workoutData);
  console.log('POST /api/workouts Status:', createWorkoutReq.status);
  const workoutId = createWorkoutReq.body.workout_id;
  if (!workoutId) {
    throw new Error('Failed to create workout: ' + JSON.stringify(createWorkoutReq.body));
  }
  console.log('Workout created with ID:', workoutId);

  // List & Verify
  const listWorkoutReq = await request('GET', '/api/workouts');
  console.log('GET /api/workouts Status:', listWorkoutReq.status);
  const foundWorkout = listWorkoutReq.body.workouts.find(w => w.id === workoutId);
  if (!foundWorkout) {
    throw new Error('Created workout not found in list!');
  }
  console.log('Workout verified in list. Details:', JSON.stringify(foundWorkout, null, 2));

  // Delete
  const delWorkoutReq = await request('DELETE', '/api/workouts', { id: workoutId });
  console.log('DELETE /api/workouts Status:', delWorkoutReq.status);
  if (!delWorkoutReq.body.success) {
    throw new Error('Failed to delete workout: ' + JSON.stringify(delWorkoutReq.body));
  }
  console.log('Workout deleted successfully.');

  // Verify Deleted
  const listWorkoutReq2 = await request('GET', '/api/workouts');
  const foundWorkout2 = listWorkoutReq2.body.workouts.find(w => w.id === workoutId);
  if (foundWorkout2) {
    throw new Error('Workout still exists after delete!');
  }
  console.log('Workout deletion verified.');


  console.log('\n=============================================');
  console.log('🎉 ALL CRUD API TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('=============================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:');
  console.error(err);
  process.exit(1);
});
