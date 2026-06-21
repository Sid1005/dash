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
  
  // Create Workout 1
  const workoutData1 = {
    date: testDate,
    exercises: [
      {
        name: 'Automated Test Bench Press',
        sets: [
          { reps: 10, weight_kg: 80 },
          { reps: 8, weight_kg: 90 }
        ],
        notes: 'Test notes 1'
      }
    ]
  };

  const createWorkoutReq1 = await request('POST', '/api/workouts', workoutData1);
  console.log('POST /api/workouts (1) Status:', createWorkoutReq1.status);
  const workoutId1 = createWorkoutReq1.body.workout_id;
  if (!workoutId1) {
    throw new Error('Failed to create workout 1: ' + JSON.stringify(createWorkoutReq1.body));
  }
  console.log('Workout 1 created with ID:', workoutId1);

  // Create Workout 2
  const workoutData2 = {
    date: testDate,
    exercises: [
      {
        name: 'Automated Test Squats',
        sets: [
          { reps: 5, weight_kg: 100 }
        ],
        notes: 'Test notes 2'
      },
      {
        name: 'Automated test Bench Press', // Same exercise name, different case to test combination
        sets: [
          { reps: 6, weight_kg: 95 }
        ],
        notes: 'Test notes 3'
      }
    ]
  };

  const createWorkoutReq2 = await request('POST', '/api/workouts', workoutData2);
  console.log('POST /api/workouts (2) Status:', createWorkoutReq2.status);
  const workoutId2 = createWorkoutReq2.body.workout_id;
  if (!workoutId2) {
    throw new Error('Failed to create workout 2: ' + JSON.stringify(createWorkoutReq2.body));
  }
  console.log('Workout 2 created with ID:', workoutId2);

  // Edit Workout 1 (PUT)
  console.log('- Testing Edit Workout (PUT)...');
  const editData = {
    id: workoutId1,
    exercises: [
      {
        name: 'Automated Test Bench Press',
        sets: [
          { reps: 12, weight_kg: 85 }, // modified reps & weight
          { reps: 10, weight_kg: 90 }, // modified reps
          { reps: 8, weight_kg: 95 }   // added set
        ],
        notes: 'Updated test notes'
      }
    ]
  };
  const editReq = await request('PUT', '/api/workouts', editData);
  console.log('PUT /api/workouts Status:', editReq.status);
  if (!editReq.body.success) {
    throw new Error('Failed to edit workout: ' + JSON.stringify(editReq.body));
  }

  // Verify Edit
  const listWorkoutReq = await request('GET', '/api/workouts');
  const verifiedWorkout1 = listWorkoutReq.body.workouts.find(w => w.id === workoutId1);
  if (!verifiedWorkout1) {
    throw new Error('Workout 1 not found after edit!');
  }
  const benchPressGroup = verifiedWorkout1.workout_exercises.filter(ex => ex.exercise_name === 'Automated Test Bench Press');
  if (benchPressGroup.length !== 3) {
    throw new Error('Edit failed: expected 3 sets of Bench Press, got ' + benchPressGroup.length);
  }
  console.log('Workout edit verified successfully.');

  // Combine Workout 1 and Workout 2 (POST /api/workouts/combine)
  console.log('- Testing Combine Workouts...');
  const combineReq = await request('POST', '/api/workouts/combine', { workoutIds: [workoutId1, workoutId2] });
  console.log('POST /api/workouts/combine Status:', combineReq.status);
  if (!combineReq.body.success) {
    throw new Error('Failed to combine workouts: ' + JSON.stringify(combineReq.body));
  }
  const primaryId = combineReq.body.primary_workout_id;
  console.log('Workouts combined into primary ID:', primaryId);

  // Verify Combined Workout
  const listWorkoutReq2 = await request('GET', '/api/workouts');
  const combinedWorkout = listWorkoutReq2.body.workouts.find(w => w.id === primaryId);
  const deletedWorkout = listWorkoutReq2.body.workouts.find(w => w.id === (primaryId === workoutId1 ? workoutId2 : workoutId1));

  if (!combinedWorkout) {
    throw new Error('Combined workout not found!');
  }
  if (deletedWorkout) {
    throw new Error('The secondary workout was not deleted after combine!');
  }

  // Check merged exercises
  const combinedBenchPress = combinedWorkout.workout_exercises.filter(
    ex => ex.exercise_name.toLowerCase() === 'automated test bench press'
  ).sort((a, b) => a.set_number - b.set_number);

  const combinedSquats = combinedWorkout.workout_exercises.filter(
    ex => ex.exercise_name.toLowerCase() === 'automated test squats'
  );

  if (combinedBenchPress.length !== 4) {
    throw new Error('Combine failed: expected 4 sets of Bench Press, got ' + combinedBenchPress.length);
  }
  // Verify set_number sequencing is 1, 2, 3, 4
  const setNums = combinedBenchPress.map(s => s.set_number);
  if (JSON.stringify(setNums) !== '[1,2,3,4]') {
    throw new Error('Combine failed: set numbers not sequenced correctly: ' + JSON.stringify(setNums));
  }
  if (combinedSquats.length !== 1) {
    throw new Error('Combine failed: expected 1 set of Squats, got ' + combinedSquats.length);
  }

  console.log('Workout combine verified successfully (exercises merged and re-sequenced).');

  // Delete Combined Workout (Clean up)
  const delWorkoutReq = await request('DELETE', '/api/workouts', { id: primaryId });
  console.log('DELETE /api/workouts Status:', delWorkoutReq.status);
  if (!delWorkoutReq.body.success) {
    throw new Error('Failed to delete combined workout: ' + JSON.stringify(delWorkoutReq.body));
  }
  console.log('Combined workout deleted successfully.');

  // Verify final cleanup
  const listWorkoutReq3 = await request('GET', '/api/workouts');
  const foundWorkoutFinal = listWorkoutReq3.body.workouts.find(w => w.id === primaryId);
  if (foundWorkoutFinal) {
    throw new Error('Combined workout still exists after delete!');
  }
  console.log('Workout final deletion and cleanup verified.');



  console.log('\n=============================================');
  console.log('🎉 ALL CRUD API TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('=============================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:');
  console.error(err);
  process.exit(1);
});
