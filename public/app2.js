var experimentApp = angular.module('experimentApp', ['ngSanitize', 'ngCsv']);
var start_time;

// function shuffle(array) {
//     for (var i = array.length - 1; i > 0; i--) {
//         var j = Math.floor(Math.random() * (i + 1));
//         var temp = array[i];
//         array[i] = array[j];
//         array[j] = temp;
//     }
//     return array
// }

experimentApp.directive('imageonload', function () {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {
      element.bind('load', function () {
        scope.$apply(function () {
          scope.loaded = true;
        });
      });
      // element.bind('error', function () {
      //   console.log('image could not be loaded');
      // });
    }
  };
});

experimentApp.controller('ExperimentController',
  function ExperimentController($scope) {
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
    $scope.csv_header = [
      "timestep",
      "goal_probs_0",
      "goal_probs_1",
      "goal_probs_2",
      "true_goal_probs"
    ];
    $scope.exam_results = [];
    // $scope.csv_name = function() {
    //   return $scope.stimuli[$scope.stim_id-1].name + "_" + Date.now() + ".csv"
    // }
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
        $scope.response.checked = [true, true, true, true, true];
      } else {
        $scope.response.checked = [false, false, false, false, false];
      }
      $scope.validate_goal();
    }
    $scope.check_all = function () {
      $scope.response = { "checked": [true, true, true, true, true] };
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
      mistake_data = {
        "yes_no": $scope.mistake_yes_no,
        "mistake": $scope.mistake_response,
        "scenario": $scope.stimuli_set[$scope.stim_id - 1].name,
      };
      console.log("Mistake Results: " + mistake_data);
      storeToDB($scope.user_id + "_mistake" + number, mistake_data);
    }
    $scope.advance = function () {
      $scope.loaded = false;
      if ($scope.section == "instructions") {
        $scope.advance_instructions()
      } else if ($scope.section == "stimuli") {
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
        $scope.true_goal = $scope.stimuli_set[$scope.stim_id].goal;
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
          $scope.instructions[$scope.inst_id + 1]['text'] += `<br><br> <b>Your bonus payment score breakdown:</b> <br>` + $scope.tutorial_text;
          // console.log($scope.tutorial_text)
          $scope.tutorial_length = 0
        }
        if ($scope.instructions[$scope.inst_id].exam) {
          let correct = $scope.instructions[$scope.inst_id].options[$scope.instructions[$scope.inst_id].answer] === $scope.exam_response;
          $scope.exam_results.push(correct);
        }
        $scope.inst_id = $scope.inst_id + 1;
      }
      $scope.response = { "checked": [false, false, false, false, false] };
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
      probs = [0, 0, 0, 0, 0];
      num_words_guessed = 0
      resp.checked.forEach((check, index) => {
        if (check) {
          probs[index] = (1 / numChecked).toFixed(2);
          num_words_guessed += 1;
        }
      })
      // Increase reward score
      reward_weights = [-2.0, 8.0, 3.0, 1.3, 0.5, 0.0]
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
      incrementCounter();
      // unhide question sliders- workaround for slider initial flashing
      document.getElementById("question").classList.remove("hidden");
    };
    $scope.possible_goals = ["red", "yellow", "blue"];
    $scope.true_goal = 0
    $scope.reward_score = 0;
    $scope.bonus_points = 0;
    $scope.tutorial_score = 0;

    $scope.gem_colors = [{color:"#D41159"}, {color:"#FFC20A"}, {color:"#1A85FF"}];
    $scope.other_goal = function(i, offset) {
      return ["red", "yellow", "blue"][(i + offset)%3];
    };
    $scope.other_color = function(i, offset) {
      return $scope.gem_colors[(i + offset)%3];
    };
    $scope.true_goal = function(id) {
      return ["red", "yellow", "blue"][$scope.stimuli[id].goal];
    };
    $scope.true_color = function(id) {
      return $scope.gem_colors[$scope.stimuli[id].goal];
    };
    $scope.chosen_goal = function(i) {
      return ["red", "yellow", "blue"][i];
    }
    $scope.chosen_color = function(id) {
      return $scope.gem_colors[id];
    }

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
    $scope.stimuli_set_length = 10;
    // circular buffer / sliding window strategy
    // 3, 7, 11, 15, 1, 5, 9, 13, 4, 8, 12, 16, 2, 6, 10, 14
    $scope.stimuli_sets = [
      // [1, 2, 3],
      [3, 7, 11, 15, 1, 5, 9, 13, 4, 8],
      [7, 11, 15, 1, 5, 9, 13, 4, 8, 12],
      [11, 15, 1, 5, 9, 13, 4, 8, 12, 16],
      [15, 1, 5, 9, 13, 4, 8, 12, 16, 2],
      [1, 5, 9, 13, 4, 8, 12, 16, 2, 6],
      [5, 9, 13, 4, 8, 12, 16, 2, 6, 10],
      [9, 13, 4, 8, 12, 16, 2, 6, 10, 14],
      [13, 4, 8, 12, 16, 2, 6, 10, 14, 3],
      [4, 8, 12, 16, 2, 6, 10, 14, 3, 7],
      [8, 12, 16, 2, 6, 10, 14, 3, 7, 11],
      [12, 16, 2, 6, 10, 14, 3, 7, 11, 15],
      [16, 2, 6, 10, 14, 3, 7, 11, 15, 1],
      [2, 6, 10, 14, 3, 7, 11, 15, 1, 5],
      [6, 10, 14, 3, 7, 11, 15, 1, 5, 9],
      [10, 14, 3, 7, 11, 15, 1, 5, 9, 13],
      [14, 3, 7, 11, 15, 1, 5, 9, 13, 4],
    ]
    $scope.instructions = [
      {
        text: `Welcome to our goal inference game! <br>
               Before you begin your task, you'll complete a brief guided tutorial (~ 5 minutes) 
               to understand the game.<br>
               Press Next to continue.`,
      },
      {
        text: `Imagine you're watching your friend play the Doors, Keys & Gems video game shown here. 
              The rules of the game are as follows: 
              <br>
              <ul>
              <li> The player decides on a target gem at the begining of the game.</li>
              <li> The player does not change the target gem along the way.</li>
              <li> The player can only move on the white squares.</li>
              <li> Keys are used to unlock doors.</li>
              <li> The player can pick up multiple keys.</li>
              <li> A key can only be used once.</li>
              </ul>
              You are watching and trying to figure out which gem your friend is trying to collect. 
              <br><br>
              Hit the <b>Next button</b> to watch your friend play. 
              `,
        image: "tutorial/demo/0.png"
      },
      {
        text: ``,
        image: "tutorial/demo/scenario-tutorial-demo.gif",
        question: `Can you figure our which gem your friend is trying to collect?`,
        options: ["Red", "Yellow", "Blue"],
        answer: 2
      },
      {
        text: `Let's watch it again, but this time, pay attention to whether your friend 
              <b>made a mistake</b> while playing.
              <br> <br>
              Hit Next to continue.`,
        image: "tutorial/demo/0.png",
        tutorial: true, 
        questions_show: false
      },
      {
        text: ``,
        image: "tutorial/demo/scenario-tutorial-demo.gif",
        question: `Can you tell if your friend <b>made a mistake</b> while playing?`,
        options: ["No, there was no mistake", 
                  "Yes, after picking up the first key they moved in the wrong direction."],
        answer: 1
      },
      {
        text: `Your task now is to watch videos of someone playing the same game, 
              and guess which gem is their target: Red, yellow, or blue?
              <br><br>
              <b>How to guess?</b> <br>
              First, you need to choose the most likely target gem. 
              If you think all three gems are equally likely, you can select the "All equally likely" option.  
              If you select one of the gems as the most likely target, 
              you then need to select how likely are the other two gems in comparison.`
      },
      {
        text: `Let's do a practice run, just so you're familiarized.`,
      },
      {
        text: `First, you'll get a chance to look at the layout. 
              Before seeing the player (red circle) move, choose which gem you think is the most likely the target gem. 
              If two gems seem equally likely, just choose either one of them for now. 
              You may also indicate that they all seem equally likely.`,
        image: "tutorial/tutorial/0.png",
        tutorial: true,
        questions_show: true
      },
      {
        text: `In the next step, the player will make the first move.
              <br><br> 
              Press Next to continue`,
        image: "tutorial/tutorial/0b.png",
        tutorial: true,
        questions_show: false
      },
      {
        text: `What do you think? Does picking up a key make any particular gem more likely? 
              If you select one of the goals as most likely, notice that you'll be asked to rate how likely 
              the other goals are in comparison. Just as likely? Half as likely? Not at all?`,
        image: "tutorial/tutorial/0.gif",
        tutorial: true,
        questions_show: true
      },
      {
        text: `How about now?`,
        image: "tutorial/tutorial/1.gif",
        tutorial: true,
        questions_show: true
      },
      {
        text: `You may soon notice that some of the player's moves don't make sense. 
              That's fine, the person playing the game <b>might make mistakes</b> sometimes.
              <br> <br>
              Press Next to see the next series of moves.`,
        image: "tutorial/tutorial/2.png",
        tutorial: true,
        questions_show: false
      },
      {
        image: "tutorial/tutorial/2.gif",
        question: `How would you best describe the mistake here? Remember, once a key is used to unlock a door, it is gone forever.`,
        options: ['I don\'t think a mistake was made.', 'The player wants the red gem but has <i><b>mistakenly</b></i> &nbsp;picked up a key and used it to unlock a door',
          'The player wants the blue gem but has used the key to open the <i><b>wrong</b></i>&nbsp; door and now they are out of keys and can\'t reach their target gem'
        ],
        footnote: "If you missed what happened, you can always replay the current move by clicking \"Replay Move\".&nbsp;",
        answer: 2
      },
      {
        text: `Let's watch the move again, make your best guess about the player's goal.
        Keep in mind throughout the following tasks that the player might make mistakes, but not always.`,
        image: "tutorial/tutorial/2b.gif",
        tutorial: true
      },
      {
        text: `Yes, your friend was aiming for the blue gem!
              <br><br>
              Notice that even though the blue gem was the true goal, the player couldn't get it and the game has ended. 
              This might happen in some of the following tasks, but keep in mind that you are always trying to guess which gem the player is 
              <i><b>trying</b></i>&nbsp; to collect.`,
        image: "tutorial/tutorial/3.png",
      },
      {
        text: `<b>Bonus Payment Points</b> <br>
                INSERT BONUS POINTS METHODS
               <br><br>
               Your points from all games are converted to bonus payment at a rate of <b>10 points = $1.00.</b>
               The points system will be explained in more detail on the next page.
               `
      },
      {
        text: `<b>Bonus Payment Points</b> <br>
               The points system works as follows:<br>
               INSERT POINT SYSTEM DETAILS
               <br><br>
               <b>Important:</b> Because <b>you might lose points</b> if you guess incorrectly, don't be over-confident! The point system is designed so that you <b>don't benefit from guessing when you don't know for sure</b>.`
      },
      {
        text: `<b>Comprehension Check Questions</b> <br>
               For the last part of the tutorial, we will ask 4 quick questions to check your understanding of the task. 
               For each question, please select the best answer.`
      },
      {
        text: `<b>Question 1/4:</b> What is the purpose of your task?`,
        options: ["Watch your friend play and decide for them which gem to collect.", "Move on the map and collect gems.",
          "Watch your friend play and try to guess which gem they are trying to collect."],
        answer: 2,
        exam: true
      },
      {
        text: `<b>Question 2/4:</b>  In a game, how many gems is your friend trying to collect?`,
        options: ["1 gem", "2 gems", "As many as possible"],
        answer: 0,
        exam: true
      },
      {
        text: `<b>Question 3/4:</b> Can your friend change their target gem while they're playing?`,
        options: ["Yes, they can", "No, they have a specific target gem at the begining of the game and can't change it"],
        answer: 1,
        exam: true
      },
      {
        text: `<b>Question 4/4:</b> You're watching your friend play and <b>none</b> of the gems seem likelier than the rest. Which is the best guessing strategy?`,
        options: ["Guess one or two gems and hope one of them is correct.", "Select the \"All equally likely\" option because I may lose bonus points from guessing incorrectly."],
        answer: 1,
        exam: true
      },
      {
        text: `Congrats! You've finished the tutorial. Your task is to guess gems for 10 different rounds. 
        For the last 2 rounds, we will also ask you whether you believe your friend made a mistake, and to describe the mistake if so.
        Ready to start? Press Next to continue!`
      }
    ];
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
        "times": [1, 2, 3, 4, 5],
        "name": "scenario_1_1",
        "optimal": true,
        "goal": 1,
        "problem": 1,
        "length": 5,
        "images": [
          "stimuli/1/1/0.png",
          "stimuli/1/1/0.gif",
          "stimuli/1/1/1.gif",
          "stimuli/1/1/2.gif",
          "stimuli/1/1/3.gif"
        ]
      },
      {
        "trial": 0,
        "times": [1, 2, 3, 4, 5],
        "name": "scenario_1_2",
        "optimal": true,
        "goal": 0,
        "problem": 1,
        "length": 5,
        "images": [
          "stimuli/1/2/0.png",
          "stimuli/1/2/0.gif",
          "stimuli/1/2/1.gif",
          "stimuli/1/2/2.gif",
          "stimuli/1/2/3.gif"
        ]
      },
      {
        "trial": 0,
        "times": [1, 2, 3, 4, 5, 6],
        "name": "scenario_1_3",
        "optimal": true,
        "goal": 0,
        "problem": 1,
        "length": 6,
        "images": [
          "stimuli/1/3/0.png",
          "stimuli/1/3/0.gif",
          "stimuli/1/3/1.gif",
          "stimuli/1/3/2.gif",
          "stimuli/1/3/3.gif",
          "stimuli/1/3/4.gif"
        ]
      },
      {
        "trial": 0,
        "times": [1, 2, 3, 4, 5, 6, 7],
        "name": "scenario_1_4",
        "optimal": true,
        "goal": 2,
        "problem": 1,
        "length": 7,
        "images": [
          "stimuli/1/4/0.png",
          "stimuli/1/4/0.gif",
          "stimuli/1/4/1.gif",
          "stimuli/1/4/2.gif",
          "stimuli/1/4/3.gif",
          "stimuli/1/4/4.gif",
          "stimuli/1/4/5.gif"
        ]
      },
      {
        "trial": 0,
        "times": [1, 2, 3, 4, 5],
        "name": "scenario_2_1",
        "optimal": true,
        "goal": 2,
        "problem": 2,
        "length": 5,
        "images": [
          "stimuli/2/1/0.png",
          "stimuli/2/1/0.gif",
          "stimuli/2/1/1.gif",
          "stimuli/2/1/2.gif",
          "stimuli/2/1/3.gif"
        ]
      },
      {
        "trial": 0,
        "times": [1, 2, 3, 4],
        "name": "scenario_2_2",
        "optimal": true,
        "goal": 0,
        "problem": 2,
        "length": 4,
        "images": [
          "stimuli/2/2/0.png",
          "stimuli/2/2/0.gif",
          "stimuli/2/2/1.gif",
          "stimuli/2/2/2.gif"
        ]
      },
      {
        "trial": 0,
        "times": [1, 2, 3, 4],
        "name": "scenario_2_3",
        "optimal": true,
        "goal": 2,
        "problem": 2,
        "length": 6,
        "images": [
          "stimuli/2/3/0.png",
          "stimuli/2/3/0.gif",
          "stimuli/2/3/1.gif",
          "stimuli/2/3/2.gif"
        ]
      },
      {
        "trial": 0,
        "times": [1, 2, 3, 4, 5],
        "name": "scenario_2_4",
        "optimal": true,
        "goal": 1,
        "problem": 2,
        "length": 5,
        "images": [
          "stimuli/2/4/0.png",
          "stimuli/2/4/0.gif",
          "stimuli/2/4/1.gif",
          "stimuli/2/4/2.gif",
          "stimuli/2/4/3.gif"
        ]
      },
      {
        "trial": 0,
        "times": [1, 2, 3, 4, 5, 6, 7, 8],
        "name": "scenario_3_1",
        "optimal": true,
        "goal": 0,
        "problem": 3,
        "length": 8,
        "images": [
          "stimuli/3/1/0.png",
          "stimuli/3/1/0.gif",
          "stimuli/3/1/1.gif",
          "stimuli/3/1/2.gif",
          "stimuli/3/1/3.gif",
          "stimuli/3/1/4.gif",
          "stimuli/3/1/5.gif",
          "stimuli/3/1/6.gif"
        ]
      },
      {
        "trial": 0,
        "times": [1, 2, 3, 4, 5, 6, 7, 8],
        "name": "scenario_3_2",
        "optimal": true,
        "goal": 1,
        "problem": 3,
        "length": 8,
        "images": [
          "stimuli/3/2/0.png",
          "stimuli/3/2/0.gif",
          "stimuli/3/2/1.gif",
          "stimuli/3/2/2.gif",
          "stimuli/3/2/3.gif",
          "stimuli/3/2/4.gif",
          "stimuli/3/2/5.gif",
          "stimuli/3/2/6.gif"
        ]
      },
      {
        "trial": 0,
        "times": [1, 2, 3, 4, 5, 6],
        "name": "scenario_3_3",
        "optimal": true,
        "goal": 1,
        "problem": 3,
        "length": 6,
        "images": [
          "stimuli/3/3/0.png",
          "stimuli/3/3/0.gif",
          "stimuli/3/3/1.gif",
          "stimuli/3/3/2.gif",
          "stimuli/3/3/3.gif",
          "stimuli/3/3/4.gif"
        ]
      },
      {
        "trial": 0,
        "times": [1, 2, 3, 4, 5, 6, 7, 8, 9],
        "name": "scenario_3_4",
        "optimal": true,
        "goal": 2,
        "problem": 3,
        "length": 9,
        "images": [
          "stimuli/3/4/0.png",
          "stimuli/3/4/0.gif",
          "stimuli/3/4/1.gif",
          "stimuli/3/4/2.gif",
          "stimuli/3/4/3.gif",
          "stimuli/3/4/4.gif",
          "stimuli/3/4/5.gif",
          "stimuli/3/4/6.gif",
          "stimuli/3/4/7.gif"
        ]
      },
      {
        "trial": 0,
        "times": [1, 2, 3, 4],
        "name": "scenario_4_1",
        "optimal": true,
        "goal": 1,
        "problem": 4,
        "length": 4,
        "images": [
          "stimuli/4/1/0.png",
          "stimuli/4/1/0.gif",
          "stimuli/4/1/1.gif",
          "stimuli/4/1/2.gif"
        ]
      },
      {
        "trial": 0,
        "times": [1, 2, 3],
        "name": "scenario_4_2",
        "optimal": true,
        "goal": 2,
        "problem": 4,
        "length": 3,
        "images": [
          "stimuli/4/2/0.png",
          "stimuli/4/2/0.gif",
          "stimuli/4/2/1.gif"
        ]
      },
      {
        "trial": 0,
        "times": [1, 2, 3],
        "name": "scenario_4_3",
        "optimal": true,
        "goal": 0,
        "problem": 4,
        "length": 3,
        "images": [
          "stimuli/4/3/0.png",
          "stimuli/4/3/0.gif",
          "stimuli/4/3/1.gif"
        ]
      },
      {
        "trial": 0,
        "times": [1, 2, 3, 4],
        "name": "scenario_4_4",
        "optimal": true,
        "goal": 2,
        "problem": 4,
        "length": 4,
        "images": [
          "stimuli/4/4/0.png",
          "stimuli/4/4/0.gif",
          "stimuli/4/4/1.gif",
          "stimuli/4/4/2.gif"
        ]
      }
    ];
  }
)
