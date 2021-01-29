var experimentApp = angular.module('experimentApp', ['ngSanitize', 'preloader']);
var start_time;

experimentApp.controller('ExperimentController',
  function ExperimentController($scope, $timeout, preloader) {
    $scope.section = "instructions";
    $scope.inst_id = 0;
    $scope.stim_id = 0;
    $scope.part_id = -1;
    $scope.tutorial_step = 1;
    $scope.tutorial_length = 7;
    $scope.tutorial_text = ``;
    $scope.comprehension_response = "";
    $scope.valid_comprehension = false;
    $scope.response = { "dontKnow": false, "checked": [false, false, false, false, false] };
    $scope.valid_goal = false;
    $scope.exam_response = "";
    $scope.valid_exam = false;
    $scope.mistake_response = "";
    $scope.mistake_yes_no = "";
    $scope.valid_mistake = false;
    $scope.last_two_scenarios = false;
    $scope.breakscreen_shown = false;
    $scope.show_rhs = true;
    $scope.exam_results = [];
    $scope.ratings = [];
    $scope.reload_gif = function () {
      if ($scope.section == "stimuli") {
        var id = document.getElementById("stimulus-img");
      } else {
        var id = document.getElementById("instruction-img")
      }
      id.src = id.src;
    }
    $scope.validate_answer = function (ans) {
      $scope.comprehension_response = ans;
      let index = $scope.instructions[$scope.inst_id].answer;
      $scope.valid_comprehension = ans == $scope.instructions[$scope.inst_id].options[index];
    }
    $scope.validate_goal = function () {
      $scope.valid_goal = $scope.response.checked.filter(check => check == true).length > 0;
    }
    $scope.toggle_dontknow = function () {
      if ($scope.response.dontKnow) {
        $scope.response.checked = [true, true, true];
      } else {
        $scope.response.checked = [false, false, false];
      }
      $scope.validate_goal();
    }
    $scope.check_all = function () {
      $scope.response = { "checked": [true, true, true] };
      $scope.valid_goal = true;
    }
    $scope.validate_exam = function (ans) {
      $scope.exam_response = ans;
      $scope.valid_exam = true;
    }
    $scope.validate_mistake = function () {
      if ($scope.mistake_yes_no == "yes") {
        $scope.valid_mistake = $scope.mistake_response.length > 0;
      } else if ($scope.mistake_yes_no.length > 0) {
        $scope.valid_mistake = true;
      }
    }
    $scope.store_mistake_data = function (number) {
      if ($scope.stimuli_set[$scope.stim_id - 1].problem == "1" && $scope.mistake_yes_no == "no") {
        $scope.mistake_bonus = 5.0;
      } else if ($scope.stimuli_set[$scope.stim_id - 1].problem != "1" && $scope.mistake_yes_no == "yes") {
        $scope.mistake_bonus = 5.0;
      } else {
        $scope.mistake_bonus = 0;
      }

      $scope.total_reward += ($scope.mistake_bonus)
      mistake_data = {
        "yes_no": $scope.mistake_yes_no,
        "mistake": $scope.mistake_response,
        "scenario": $scope.stimuli_set[$scope.stim_id - 1].name,
        "score": $scope.mistake_bonus
      };
      console.log("Mistake Results: " + mistake_data);
      storeToDB($scope.user_id + "_mistake" + number, mistake_data);
    }
    $scope.store_total_reward = function () {
      storeToDB($scope.user_id + "_total_reward", $scope.total_reward);
    }
    $scope.advance = function () {
      if ($scope.section == "instructions") {
        $scope.advance_instructions()
      } else if ($scope.section == "stimuli" || $scope.section == "breakscreen") {
        $scope.section = "stimuli";
        $scope.advance_stimuli()
      } else if ($scope.section == "endscreen") {
        // Do nothing
      }
    };
    $scope.advance_instructions = function () {
      if ($scope.inst_id == $scope.instructions.length - 1) {
        storeToDB($scope.user_id + "_tutorial", $scope.ratings);
        exam_data = {
          "results": $scope.exam_results,
          "score": $scope.exam_results.filter(correct => correct == true).length
        }
        console.log("Exam Results: " + exam_data);
        storeToDB($scope.user_id + "_exam", exam_data);
        $scope.reward_score = 0;
        $scope.section = "stimuli";
        $scope.stim_id = 0;
        $scope.part_id = 0;
        $scope.ratings = [];
        $scope.true_goal = $scope.stimuli_set[$scope.stim_id].goal;
        preloader.preloadImages($scope.stimuli_set[$scope.stim_id].images).then(
          function handleResolve(imglocs) {console.info("Preloaded stimulus.");});
        // get time of first experiment
        if (start_time == undefined) {
          start_time = (new Date()).getTime();
        }
      } else {
        if ($scope.instructions[$scope.inst_id].tutorial) {
          $scope.ratings.push($scope.compute_ratings($scope.response));
          $scope.tutorial_text += `Step ` + $scope.tutorial_step + `: you gave a ` + $scope.points * 10 +
            `% rating to <b>power</b>: ` + $scope.points + ` points <br>`;
          $scope.tutorial_step = $scope.tutorial_step + 1;
        }
        if ($scope.tutorial_step == $scope.tutorial_length + 1) {
          $scope.tutorial_score = ($scope.tutorial_score / $scope.tutorial_length).toFixed(1);
          $scope.tutorial_text += `<br>Averaging all the points, your score for this game is: ` + $scope.tutorial_score +
            ` points`;
          $scope.tutorial_length = 0
        }
        if ($scope.instructions[$scope.inst_id].exam) {
          let correct = $scope.instructions[$scope.inst_id].options[$scope.instructions[$scope.inst_id].answer] === $scope.exam_response;
          $scope.exam_results.push(correct);
        }
        $scope.inst_id = $scope.inst_id + 1;
        if ($scope.instructions[$scope.inst_id].delay > 0) {
          $scope.show_rhs = false;
          $timeout(function() {$scope.show_rhs = true;},
                   $scope.instructions[$scope.inst_id].delay);
        }
      }
      $scope.response = { "checked": [false, false, false] };
      $scope.valid_goal = false;
      $scope.comprehension_response = "";
      $scope.valid_comprehension = false;
      $scope.exam_response = "";
      $scope.valid_exam = false;
    };
    $scope.advance_stimuli = function () {
      $scope.last_two_scenarios = $scope.stim_id >= $scope.stimuli_set.length - 2;
      if ($scope.stim_id == $scope.stimuli_set.length) {
        // Advance section
        storeToDB($scope.user_id + "_" + $scope.stimuli_set[$scope.stim_id - 1].name, $scope.ratings);
        $scope.reward_score = 0;
        // Store mistake response
        $scope.store_mistake_data(2);
        // Show endscreen (survey code)
        $scope.section = "endscreen"
        if ($scope.total_reward > 0) {
          $scope.total_payment = ($scope.total_reward / 10).toFixed(2)
        } else {
          $scope.total_payment = 0.0
        }
        $scope.total_reward = $scope.total_reward.toFixed(1)
        $scope.store_total_reward()
        // Show break screen before last 2 stimuli
      } else if ($scope.last_two_scenarios && $scope.breakscreen_shown == false) {
        $scope.section = "breakscreen";
        $scope.breakscreen_shown = true;
      } else if ($scope.part_id < 0) {
        // Store result to DB
        storeToDB($scope.user_id + "_" + $scope.stimuli_set[$scope.stim_id - 1].name, $scope.ratings);
        $scope.reward_score = 0;
        if ($scope.last_two_scenarios && (
          ($scope.mistake_yes_no == "yes" && $scope.mistake_response.length > 0) ||
          $scope.mistake_yes_no.length > 0 && $scope.mistake_yes_no.length != "yes")) {
          $scope.store_mistake_data(1);
        }
        // Advance to first part
        preloader.preloadImages($scope.stimuli_set[$scope.stim_id].images).then(
          function handleResolve(imglocs) {console.info("Preloaded stimulus.");});
        $scope.part_id = $scope.part_id + 1;
        $scope.ratings = [];
        $scope.true_goal = $scope.stimuli_set[$scope.stim_id].goal;
      } else if ($scope.part_id < $scope.stimuli_set[$scope.stim_id].length) {
        // Advance to next part
        $scope.ratings.push($scope.compute_ratings($scope.response));
        $scope.part_id = $scope.part_id + 1;
        if ($scope.part_id == $scope.stimuli_set[$scope.stim_id].length) {
          // Advance to next problem.
          $scope.part_id = -1;
          $scope.stim_id = $scope.stim_id + 1;
          $scope.bonus_points = (($scope.reward_score) / $scope.stimuli_set[$scope.stim_id - 1].length).toFixed(1);
          $scope.total_reward += parseFloat($scope.bonus_points)
        }
      }
      $scope.response = { "checked": [false, false, false, false, false] };
      $scope.valid_goal = false;
      $scope.mistake_response = "";
      $scope.mistake_yes_no = "";
      $scope.valid_mistake = false;
    };
    $scope.compute_ratings = function (resp) {
      // Compute probs from checkboxes
      let numChecked = resp.checked.filter(check => check == true).length;
      probs = [0, 0, 0];
      num_words_guessed = 0
      resp.checked.forEach((check, index) => {
        if (check) {
          probs[index] = (1 / numChecked).toFixed(2);
          num_words_guessed += 1;
        }
      })
      // Increase reward score
      reward_weights = [-2.0, 4.0, 2.0, 0]
      console.log($scope.stimuli_set[$scope.stim_id].goal)
      console.log(probs[$scope.stimuli_set[$scope.stim_id].goal])
      if (probs[$scope.true_goal] != 0) {
        $scope.reward_score += reward_weights[num_words_guessed];
      }
      else {
        $scope.reward_score += reward_weights[0];
      }
      console.log("reward = " + $scope.reward_score)

      if ($scope.section == "instructions") {
        $scope.points = (probs[$scope.true_goal] * 10).toFixed(1);
        $scope.tutorial_score += probs[$scope.true_goal] * 10;
        rating = {
          "timestep": $scope.tutorial_step,
          "time_spent": 0,
          "goal_probs_0": probs[0],
          "goal_probs_1": probs[1],
          "goal_probs_2": probs[2],
          "true_goal_probs": probs[$scope.true_goal],
          "reward_score": $scope.reward_score
        }
      }
      else {
        rating = {
          "timestep": $scope.stimuli_set[$scope.stim_id].times[$scope.part_id],
          "time_spent": ((new Date()).getTime() - start_time) / 1000.,
          "goal_probs_0": probs[0],
          "goal_probs_1": probs[1],
          "goal_probs_2": probs[2],
          "true_goal_probs": probs[$scope.true_goal],
          "reward_score": $scope.reward_score
        }
        start_time = (new Date()).getTime();
      }
      return rating;
    };
    $scope.user_id = Date.now();
    $scope.stimuli_set = [];
    $scope.loaded = false;
    $scope.setStimuli = async function () {
      let count = await getCounter();
      let stim_idx = $scope.stimuli_sets[count % $scope.stimuli.length];
      // uncomment for testing stimuli
      // stim_idx = $scope.stimuli_sets[0];
      for (i = 0; i < stim_idx.length; i++) {
        $scope.stimuli_set.push($scope.stimuli[stim_idx[i] - 1]);
      }
      console.log("stimuli set = " + stim_idx);
      // store stimuli set
      storeToDB($scope.user_id + "_stimuli_set", stim_idx);
      incrementCounter();
      // unhide question sliders- workaround for slider initial flashing
      document.getElementById("question").classList.remove("hidden");
    };
    $scope.possible_goals = ["red", "yellow", "blue"];
    $scope.true_goal = 0
    $scope.reward_score = 0;
    $scope.bonus_points = 0;
    $scope.total_reward = 0;
    $scope.mistake_bonus = 0
    $scope.tutorial_score = 0;

    $scope.gem_colors = [{color:"#D41159"}, {color:"#FFC20A"}, {color:"#1A85FF"}];
    $scope.true_color = function(id) {
      return $scope.gem_colors[$scope.true_goal];
    };

    $scope.instruction_has_image = function () {
      return $scope.instructions[$scope.inst_id].image != null
    };
    $scope.instruction_has_question = function () {
      return $scope.instructions[$scope.inst_id].question != null
    };
    $scope.is_exam = function () {
      return $scope.instructions[$scope.inst_id].exam == true
    };
    $scope.is_tutorial = function () {
      return $scope.instructions[$scope.inst_id].tutorial == true
    };
    $scope.hide_questions = function () {
      return $scope.instructions[$scope.inst_id].questions_show == false
      //return false
    };
    // circular buffer / sliding window strategy
    // 3, 7, 11, 15, 1, 5, 9, 13, 4, 8, 12, 16, 2, 6, 10, 14
    $scope.stimuli_sets = [
      // uncomment to test mistake response
      // [1, 2, 3],
      [3, 7, 11, 15, 1, 5, 9, 13, 4, 8, 12, 16, 2, 6, 10, 14],
      [7, 11, 15, 1, 5, 9, 13, 4, 8, 12, 16, 2, 6, 10, 14, 3],
      [11, 15, 1, 5, 9, 13, 4, 8, 12, 16, 2, 6, 10, 14, 3, 7],
      [15, 1, 5, 9, 13, 4, 8, 12, 16, 2, 6, 10, 14, 3, 7, 11],
      [1, 5, 9, 13, 4, 8, 12, 16, 2, 6, 10, 14, 3, 7, 11, 15],
      [5, 9, 13, 4, 8, 12, 16, 2, 6, 10, 14, 3, 7, 11, 15, 1],
      [9, 13, 4, 8, 12, 16, 2, 6, 10, 14, 3, 7, 11, 15, 1, 5],
      [13, 4, 8, 12, 16, 2, 6, 10, 14, 3, 7, 11, 15, 1, 5, 9],
      [4, 8, 12, 16, 2, 6, 10, 14, 3, 7, 11, 15, 1, 5, 9, 13],
      [8, 12, 16, 2, 6, 10, 14, 3, 7, 11, 15, 1, 5, 9, 13, 4],
      [12, 16, 2, 6, 10, 14, 3, 7, 11, 15, 1, 5, 9, 13, 4, 8],
      [16, 2, 6, 10, 14, 3, 7, 11, 15, 1, 5, 9, 13, 4, 8, 12],
      [2, 6, 10, 14, 3, 7, 11, 15, 1, 5, 9, 13, 4, 8, 12, 16],
      [6, 10, 14, 3, 7, 11, 15, 1, 5, 9, 13, 4, 8, 12, 16, 2],
      [10, 14, 3, 7, 11, 15, 1, 5, 9, 13, 4, 8, 12, 16, 2, 6],
      [14, 3, 7, 11, 15, 1, 5, 9, 13, 4, 8, 12, 16, 2, 6, 10]

      // [7, 11, 15, 1, 5, 9, 13, 4, 8, 12],
      // [11, 15, 1, 5, 9, 13, 4, 8, 12, 16],
      // [15, 1, 5, 9, 13, 4, 8, 12, 16, 2],
      // [1, 5, 9, 13, 4, 8, 12, 16, 2, 6],
      // [5, 9, 13, 4, 8, 12, 16, 2, 6, 10],
      // [9, 13, 4, 8, 12, 16, 2, 6, 10, 14],
      // [13, 4, 8, 12, 16, 2, 6, 10, 14, 3],
      // [4, 8, 12, 16, 2, 6, 10, 14, 3, 7],
      // [8, 12, 16, 2, 6, 10, 14, 3, 7, 11],
      // [12, 16, 2, 6, 10, 14, 3, 7, 11, 15],
      // [16, 2, 6, 10, 14, 3, 7, 11, 15, 1],
      // [2, 6, 10, 14, 3, 7, 11, 15, 1, 5],
      // [6, 10, 14, 3, 7, 11, 15, 1, 5, 9],
      // [10, 14, 3, 7, 11, 15, 1, 5, 9, 13],
      // [14, 3, 7, 11, 15, 1, 5, 9, 13, 4],
    ]
    $scope.stimuli_set_length = $scope.stimuli_sets[0].length;
    $scope.instructions = [
      {
        text: `Welcome to our goal prediction game! <br>
               Before you begin your task, you'll complete a brief guided tutorial (~ 5 minutes)
               to understand the game.<br>
               Press Next to continue.`,
      },
      {
        text: `Imagine you're watching someone play the video game shown to the left.
               At the beginning of the game, the player is given a target gem (one of: Red, Blue, Yellow).
              The rules of the game are as follows:
              <br>
              <ul>
              <li> The player's goal is to collect their target gem.</li>
              <li> The player can move on the white squares.</li>
              <li> The player has a full view of the map at all times.</li>
              <li> The player can pick up keys and gems at their position.</li>
              <li> Keys are used to unlock doors.</li>
              <li> A key can only be used once.</li>
              <li> The player can pick up multiple keys.</li>
              <li> The game ends if it's no longer possible for the player to obtain their target gem.</li>
              </ul>
              Your task is to watch and try to <b> figure out which gem the player is trying to collect</b>.
              <br><br>
              Press the <b>Next</b> button to watch.
              `,
        image: "tutorial/demo/0.gif"
      },
      {
        text: ``,
        image: "tutorial/demo/scenario-tutorial-demo.gif",
        question: `Can you figure out which gem the player is trying to collect?`,
        options: ["Red", "Yellow", "Blue"],
        answer: 1
      },
      {
        text: `Let's watch it again, but this time, pay attention to whether the player
              <b>made a mistake</b>.
              <br> <br>
              Press Next to continue, then watch closely.`,
        image: "tutorial/demo/0.gif",
        tutorial: true,
        questions_show: false
      },
      {
        text: ``,
        image: "tutorial/demo/scenario-tutorial-demo.gif",
        question: `Can you tell if the player <b>made a mistake</b>?`,
        options: ["No, there was no mistake",
                  "Yes, they accidentally moved past the second key."],
        footnote: "If you missed what happened, you can always replay the current move by clicking \"Replay\".",
        answer: 1
      },
      {
        text: `Your task now is to watch videos of someone playing the game,
              and guess which gem they are most likely trying to collect: Red, Yellow, or Blue?
              <br><br>
              <b>How to guess?</b> <br>
              As the player moves on the map, you need to choose which gem you think they are most likely trying to collect.
              You can select <b>more than one gem</b> if there are <b>several likely choices</b>!
              If you think all three gems are equally likely, you can select the "All Equally Likely" option.`
      },
      {
        text: `Let's do a practice run, just so you're familiarized.`,
      },
      {
        text: `First, you'll get a chance to look at the layout.
              Before seeing the player (red triangle) move, choose which gem you think is most likely the goal gem.
              If all three gems seem equally likely, you can select the "All Equally Likely" option. `,
        image: "tutorial/tutorial/0.gif",
        tutorial: true,
        questions_show: true
      },
      {
        text: `Now watch the player move a few steps ahead.
              <br><br>
              Press Next to continue, then watch closely.`,
        image: "tutorial/tutorial/0.gif",
        tutorial: true,
        questions_show: false
      },
      {
        text: `What do you think? Does picking up the key make some of the gems more likely?
              If you think two gems are <b>equally likely</b>, you can select <b>both</b> of them.`,
        image: "tutorial/tutorial/1.gif",
        footnote: "Once done, press Next to watch the next series of moves.",
        tutorial: true,
        questions_show: true,
        delay: 1000
      },
      {
        text: `How about now? Do these actions make any particular gem more likely than the others?`,
        image: "tutorial/tutorial/2.gif",
        tutorial: true,
        questions_show: true,
        delay: 3000
      },
      {
        text: `You may soon notice that the player may not always take the most efficient path
              to the goal. That's fine - the person playing the game might <b>make mistakes</b>
              or <b>be inefficient</b>.
              <br> <br>
              Press Next to see the next series of moves.`,
        image: "tutorial/tutorial/2b.gif",
        tutorial: true,
        questions_show: false
      },
      {
        image: "tutorial/tutorial/3.gif",
        question: `Is the player taking the most efficient path to their goal? Remember, once a key is used to unlock a door, it is gone forever.`,
        options: ['Yes, the player is taking the shortest path possible to their goal.',
                  'No, they could have picked up both keys before unlocking the door.'
        ],
        footnote: "If you missed what happened, you can always replay the current move by clicking \"Replay\".",
        answer: 1,
        delay: 3000
      },
      {
        text: `Let's watch the move again, make your best guess about the player's goal.
        Keep in mind throughout the following tasks that the player might sometimes be
        inefficient or make mistakes.`,
        image: "tutorial/tutorial/3b.gif",
        tutorial: true,
        questions_show: false
      },
      {
        text: "",
        image: "tutorial/tutorial/3.gif",
        tutorial: true
      },
      {
        text: `The player is now going back for the second key.`,
        image: "tutorial/tutorial/4.gif",
        tutorial: true
      },
      {
        text: `Even if it seems obvious what the goal is, do make sure to
               answer by selecting the most likely gem only.`,
        image: "tutorial/tutorial/5.gif",
        tutorial: true
      },
      {
        text: `Yes, the player was aiming for the blue gem!`,
        image: "tutorial/tutorial/6.gif",
      },
      {
        text: `<b>Bonus Payment Points</b> <br>
               As you play, you can earn <b>bonus payment</b> by collecting <b>points for each guess</b>  you make,
               based on <b>how correct</b> the guess is. Your score for each game is the average score of your guesses in the game,
               and will be <b>displayed after that game</b>.
               <br><br>
               Your points from all games are converted to bonus payment at a rate of <b>10 points = $1.00.</b>
               The points system will be explained in more detail on the next page.
               `
      },
      {
        text: `<b>Bonus Payment Points</b> <br>
               The points system works as follows:<br>
               The points system works as follows:<br>
               <b>-2.0 points</b> if none of the gems you choose is correct <br>
               <b>0.0 points</b> for saying "All Equally Likely" or choosing all gems<br>
               <b>2.0 points</b> for choosing 2 gems, one of which is the correct gem <br>
               <b>4.0 points</b> for choosing only the correct gem
               <br><br>
               <b>Important:</b> Because <b>you might lose points</b> if you guess incorrectly, don't be over-confident!
               The point system is designed so that you <b>don't benefit from guessing when you don't know for sure</b>.`
      },
      {
        text: `<b>Comprehension Check Questions</b> <br>
               For the last part of the tutorial, we will ask 4 quick questions to check your understanding of the task.
               For each question, please select the best answer.`
      },
      {
        text: `<b>Question 1/4:</b> What is the purpose of your task?`,
        options: ["Decide which gem the player should collect.", "Control the player to collect gems.",
          "Watch someone play and try to guess which gem they are trying to collect."],
        answer: 2,
        exam: true
      },
      {
        text: `<b>Question 2/4:</b>  In a game, how many gems is the player trying to collect?`,
        options: ["1 gem only", "2 gems only", "As many as possible"],
        answer: 0,
        exam: true
      },
      {
        text: `<b>Question 3/4:</b> You're watching the player and <b>two</b> of the gems seem likelier than the third. What should you do?`,
        options: ["Guess <b>one</b> of the two likely gems.", "Guess <b>both</b> likely gems."],
        answer: 1,
        exam: true
      },
      {
        text: `<b>Question 4/4:</b> You're watching the player and <b>none</b> of the gems seem likelier than the rest. Which is the best guessing strategy?`,
        options: ["Guess one or two gems and hope one of them is correct.", "Select the \"All Equally Likely\" option because I may lose bonus points from guessing incorrectly."],
        answer: 1,
        exam: true
      },
      {
        text: `Congrats! You've finished the tutorial. Your task is to guess gems for 16 different rounds.
        For the last 2 rounds, we will also ask you whether you believe the player made a mistake, and to describe the mistake if so.
        Ready to start? Press Next to continue!`
      }
    ];
    instruction_images =
      $scope.instructions.filter(i => i.image !== undefined).map(i => i.image);
    preloader.preloadImages(instruction_images).then(
      function handleResolve(imglocs) {console.info("Preloaded instructions.");});
    $scope.stimuli = [
      // uncomment to test mistake response
      // {
      //   "trial": 0,
      //   "times": [1],
      //   "name": "scenario_1_1",
      //   "optimal": true,
      //   "goal_space": ["power", "cower", "crow", "core", "pore"],
      //   "goal": 3,
      //   "problem": 1,
      //   "length": 1,
      //   "images": [
      //     "stimuli/1/1/0.png",
      //   ]
      // },
      // {
      //   "trial": 0,
      //   "times": [1],
      //   "name": "scenario_1_2",
      //   "optimal": true,
      //   "goal_space": ["power", "cower", "crow", "core", "pore"],
      //   "goal": 3,
      //   "problem": 1,
      //   "length": 1,
      //   "images": [
      //     "stimuli/1/1/0.png",
      //   ]
      // },
      // {
      //   "trial": 0,
      //   "times": [1],
      //   "name": "scenario_1_3",
      //   "optimal": true,
      //   "goal_space": ["power", "cower", "crow", "core", "pore"],
      //   "goal": 3,
      //   "problem": 1,
      //   "length": 1,
      //   "images": [
      //     "stimuli/1/1/0.png",
      //   ]
      // },
        {
          "trial": 0,
          "times": [
            1,
            7,
            13,
            19,
            25,
            30
          ],
          "name": "scenario_1_3",
          "optimal": false,
          "goal": 0,
          "problem": 4,
          "length": 5,
          "images": [
            "stimuli/scenario_1_3_0.gif",
            "stimuli/scenario_1_3_1.gif",
            "stimuli/scenario_1_3_2.gif",
            "stimuli/scenario_1_3_3.gif",
            "stimuli/scenario_1_3_4.gif",
            "stimuli/scenario_1_3_5.gif"
          ]
        },
        {
          "trial": 0,
          "times": [
            1,
            8,
            15,
            22,
            29,
            36,
            43,
            50,
            56
          ],
          "name": "scenario_3_2",
          "optimal": false,
          "goal": 1,
          "problem": 4,
          "length": 8,
          "images": [
            "stimuli/scenario_3_2_0.gif",
            "stimuli/scenario_3_2_1.gif",
            "stimuli/scenario_3_2_2.gif",
            "stimuli/scenario_3_2_3.gif",
            "stimuli/scenario_3_2_4.gif",
            "stimuli/scenario_3_2_5.gif",
            "stimuli/scenario_3_2_6.gif",
            "stimuli/scenario_3_2_7.gif",
            "stimuli/scenario_3_2_8.gif"
          ]
        },
        {
          "trial": 0,
          "times": [
            1,
            8,
            15,
            18
          ],
          "name": "scenario_2_2",
          "optimal": false,
          "goal": 0,
          "problem": 5,
          "length": 3,
          "images": [
            "stimuli/scenario_2_2_0.gif",
            "stimuli/scenario_2_2_1.gif",
            "stimuli/scenario_2_2_2.gif",
            "stimuli/scenario_2_2_3.gif"
          ]
        },
        {
          "trial": 0,
          "times": [
            1,
            7
          ],
          "name": "scenario_4_2",
          "optimal": false,
          "goal": 2,
          "problem": 5,
          "length": 2,
          "images": [
            "stimuli/scenario_4_2_0.gif",
            "stimuli/scenario_4_2_1.gif"
          ]
        },
        {
          "trial": 0,
          "times": [
            1,
            8,
            15,
            22,
            29,
            36,
            43,
            50,
            55
          ],
          "name": "scenario_3_1",
          "optimal": false,
          "goal": 0,
          "problem": 6,
          "length": 8,
          "images": [
            "stimuli/scenario_3_1_0.gif",
            "stimuli/scenario_3_1_1.gif",
            "stimuli/scenario_3_1_2.gif",
            "stimuli/scenario_3_1_3.gif",
            "stimuli/scenario_3_1_4.gif",
            "stimuli/scenario_3_1_5.gif",
            "stimuli/scenario_3_1_6.gif",
            "stimuli/scenario_3_1_7.gif",
            "stimuli/scenario_3_1_8.gif"
          ]
        },
        {
          "trial": 0,
          "times": [
            1,
            8,
            15,
            22,
            26
          ],
          "name": "scenario_1_1",
          "optimal": false,
          "goal": 1,
          "problem": 6,
          "length": 4,
          "images": [
            "stimuli/scenario_1_1_0.gif",
            "stimuli/scenario_1_1_1.gif",
            "stimuli/scenario_1_1_2.gif",
            "stimuli/scenario_1_1_3.gif",
            "stimuli/scenario_1_1_4.gif"
          ]
        },
        {
          "trial": 0,
          "times": [
            1,
            7,
            13,
            19,
            23
          ],
          "name": "scenario_1_2",
          "optimal": false,
          "goal": 0,
          "problem": 7,
          "length": 4,
          "images": [
            "stimuli/scenario_1_2_0.gif",
            "stimuli/scenario_1_2_1.gif",
            "stimuli/scenario_1_2_2.gif",
            "stimuli/scenario_1_2_3.gif",
            "stimuli/scenario_1_2_4.gif"
          ]
        },
        {
          "trial": 0,
          "times": [
            1,
            8,
            15,
            20
          ],
          "name": "scenario_4_1",
          "optimal": false,
          "goal": 1,
          "problem": 7,
          "length": 4,
          "images": [
            "stimuli/scenario_4_1_0.gif",
            "stimuli/scenario_4_1_1.gif",
            "stimuli/scenario_4_1_2.gif",
            "stimuli/scenario_4_1_3.gif"
          ]
        },
        {
          "trial": 0,
          "times": [
            1,
            8,
            15,
            22,
            29,
            36,
            43,
            47
          ],
          "name": "scenario_2_4",
          "optimal": false,
          "goal": 1,
          "problem": 8,
          "length": 8,
          "images": [
            "stimuli/scenario_2_4_0.gif",
            "stimuli/scenario_2_4_1.gif",
            "stimuli/scenario_2_4_2.gif",
            "stimuli/scenario_2_4_3.gif",
            "stimuli/scenario_2_4_4.gif",
            "stimuli/scenario_2_4_5.gif",
            "stimuli/scenario_2_4_6.gif",
            "stimuli/scenario_2_4_7.gif"
          ]
        },
        {
          "trial": 0,
          "times": [
            1,
            8,
            15,
            22,
            29,
            36,
            43,
            50,
            53
          ],
          "name": "scenario_3_4",
          "optimal": false,
          "goal": 2,
          "problem": 8,
          "length": 9,
          "images": [
            "stimuli/scenario_3_4_0.gif",
            "stimuli/scenario_3_4_1.gif",
            "stimuli/scenario_3_4_2.gif",
            "stimuli/scenario_3_4_3.gif",
            "stimuli/scenario_3_4_4.gif",
            "stimuli/scenario_3_4_5.gif",
            "stimuli/scenario_3_4_6.gif",
            "stimuli/scenario_3_4_7.gif",
            "stimuli/scenario_3_4_8.gif"
          ]
        },
        {
          "trial": 0,
          "times": [
            1,
            8,
            15,
            22,
            27
          ],
          "name": "scenario_2_1",
          "optimal": false,
          "goal": 2,
          "problem": 9,
          "length": 4,
          "images": [
            "stimuli/scenario_2_1_0.gif",
            "stimuli/scenario_2_1_1.gif",
            "stimuli/scenario_2_1_2.gif",
            "stimuli/scenario_2_1_3.gif",
            "stimuli/scenario_2_1_4.gif"
          ]
        },
        {
          "trial": 0,
          "times": [
            1,
            8,
            10
          ],
          "name": "scenario_4_3",
          "optimal": false,
          "goal": 0,
          "problem": 10,
          "length": 3,
          "images": [
            "stimuli/scenario_4_3_0.gif",
            "stimuli/scenario_4_3_1.gif",
            "stimuli/scenario_4_3_2.gif"
          ]
        },
        {
          "trial": 0,
          "times": [
            1,
            8,
            15,
            18
          ],
          "name": "scenario_2_3",
          "optimal": false,
          "goal": 2,
          "problem": 10,
          "length": 3,
          "images": [
            "stimuli/scenario_2_3_0.gif",
            "stimuli/scenario_2_3_1.gif",
            "stimuli/scenario_2_3_2.gif",
            "stimuli/scenario_2_3_3.gif"
          ]
        },
        {
          "trial": 0,
          "times": [
            1,
            7,
            13,
            19,
            25,
            30
          ],
          "name": "scenario_3_3",
          "optimal": false,
          "goal": 1,
          "problem": 11,
          "length": 5,
          "images": [
            "stimuli/scenario_3_3_0.gif",
            "stimuli/scenario_3_3_1.gif",
            "stimuli/scenario_3_3_2.gif",
            "stimuli/scenario_3_3_3.gif",
            "stimuli/scenario_3_3_4.gif",
            "stimuli/scenario_3_3_5.gif"
          ]
        },
        {
          "trial": 0,
          "times": [
            1,
            8,
            15,
            22,
            29,
            36,
            39
          ],
          "name": "scenario_1_4",
          "optimal": false,
          "goal": 2,
          "problem": 12,
          "length": 6,
          "images": [
            "stimuli/scenario_1_4_0.gif",
            "stimuli/scenario_1_4_1.gif",
            "stimuli/scenario_1_4_2.gif",
            "stimuli/scenario_1_4_3.gif",
            "stimuli/scenario_1_4_4.gif",
            "stimuli/scenario_1_4_5.gif",
            "stimuli/scenario_1_4_6.gif"
          ]
        },
        {
          "trial": 1,
          "times": [
            1,
            8,
            15,
            17
          ],
          "name": "scenario_4_4",
          "optimal": false,
          "goal": 2,
          "problem": 12,
          "length": 4,
          "images": [
            "stimuli/scenario_4_4_0.gif",
            "stimuli/scenario_4_4_1.gif",
            "stimuli/scenario_4_4_2.gif",
            "stimuli/scenario_4_4_3.gif"
          ]
        }
      ];
  }
)
