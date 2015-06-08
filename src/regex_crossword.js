(function (w, d) {
  'use strict';

  var config, logger;

  config = w.goodies = w.goodies || { };

  config.debugMode = !!localStorage.goodiesDebugMode;

  logger = {};
  ['debug', 'log', 'info', 'error', 'warn'].forEach(function (funcName) {
    logger[funcName] = function () {
      if (config.debugMode) {
        console[funcName].apply(console, arguments);
      }
    };
  });

  function addPlayerPuzzlesPageFunctionality(scope, titleElement) {
    var chk, ui = d.createElement('div');
    ui.innerHTML = '<input type="checkbox" id="chkTodo" /> &nbsp;' +
                   '<label for="chkTodo">Only show unsolved unambiguous puzzles</label>';

    titleElement.parentElement.insertBefore(ui, titleElement.nextElementSibling);

    chk = d.getElementById('chkTodo');
    chk.addEventListener('click', function () {
      scope.allPuzzles = scope.allPuzzles || scope.puzzles;

      if (this.checked) {
        scope.puzzles = scope.allPuzzles.filter(function (p) {
          return !(p.solved || p.ambiguous);
        });
      } else {
        scope.puzzles = scope.allPuzzles;
      }

      scope.$apply();
    });
  }

  function addPuzzleFunctionality(scope, topElement) {
    var puzzleAdapter, ui, persistence,
      puzzle = scope.puzzle,

      Cell = function (inputElement, angularModel) {
        var self = this;

        this.ui = inputElement;
        this.regexes = [];

        inputElement.addEventListener('input', function () {
          self.regexes.forEach(function (re) {
            re.validate();
          });
        });

        this.registerRegexElement = function (regexElement) {
          this.regexes.push(regexElement);
        };

        this.getValue = function () {
          if (inputElement.classList.contains('space')) {
            return ' ';
          }

          if (inputElement.value) {
            return inputElement.value.toUpperCase();
          }

          return null;
        };

        this.setValue = function (newValue) {
          if (newValue === ' ') {
            inputElement.classList.add('space');
          } else {
            inputElement.classList.remove('space');
          }
          angularModel.value = newValue;
        };
      },

      RegexElement = function (cells, expression, uiClueElement) {
        var self = this;

        cells.forEach(function (c) {
          c.registerRegexElement(self);
        });

        this.regex = new RegExp('^(?:' + expression + ')$');

        this.validate = function () {
          logger.debug('Validating: ' + this.regex);

          var answer = '', i, chr;

          for (i = 0; i < cells.length; i++) {
            chr = cells[i].getValue();

            if (chr) {
              answer += chr;
            } else {
              answer = null;
              break;
            }
          }

          uiClueElement.classList.remove('clue-error');
          uiClueElement.classList.remove('clue-ok');

          if (answer) {
            if (answer.match(this.regex)) {
              uiClueElement.classList.add('clue-ok');
            } else {
              uiClueElement.classList.add('clue-error');
            }
          }
        };
      },

      RectangularPuzzleAdapter = function () {
        var rowCount, colCount,
          self = this,
          emptyCellPlaceholder = '\xB7';

        this.regexElements = [];

        function getCells(textBoxes) {
          var cells = [], i, j;

          for (i = 0; i < rowCount; i++) {
            for (j = 0; j < colCount; j++) {
              cells.push(new Cell(
                textBoxes[i * colCount + j],
                scope.puzzle.answer.rows[i][j]
              ));
            }
          }

          return cells;
        }

        function addHorizontalRegexElements(cells) {
          var usedCells = [], patterns, i,
            clueUIElements = topElement.querySelectorAll('th.clue');

          for (i = 0; i < rowCount; i++) {
            usedCells = cells.slice(i * colCount, (i + 1) * colCount);

            patterns = scope.puzzle.patternsY.patterns[i];

            // left clue
            if (patterns.a.value) {
              self.regexElements.push(
                new RegexElement(usedCells, patterns.a.value, clueUIElements[i * 2])
              );
            }

            // right clue
            if (patterns.b.value) {
              self.regexElements.push(
                new RegexElement(usedCells, patterns.b.value, clueUIElements[i * 2 + 1])
              );
            }
          }
        }

        function addVerticalRegexElements(cells) {
          var usedCells, patterns, i, j,
            clueUIElements = topElement.querySelectorAll('div.clue');

          for (j = 0; j < colCount; j++) {
            usedCells = [];

            for (i = 0; i < rowCount; i++) {
              usedCells.push(cells[i * colCount + j]);
            }

            patterns = scope.puzzle.patternsX.patterns[j];

            // top clue
            if (patterns.a.value) {
              self.regexElements.push(
                new RegexElement(usedCells, patterns.a.value, clueUIElements[j])
              );
            }

            // bottom clue
            if (patterns.b.value) {
              self.regexElements.push(
                new RegexElement(usedCells, patterns.b.value, clueUIElements[j + colCount])
              );
            }
          }
        }

        this.init = function () {
          var textBoxes;

          rowCount = scope.puzzle.answer.rows.length;
          colCount = scope.puzzle.answer.rows[0].length;

          logger.debug('Rectangular puzzle ' + colCount + ' by ' + rowCount);
          textBoxes = topElement.querySelectorAll('input.char');

          if (textBoxes.length < rowCount * colCount) {
            logger.debug('Waiting for textboxes to render...');
            w.setTimeout(function () {
              self.init();
            }, 10);

            return;
          }

          this.cells = getCells(textBoxes);

          addHorizontalRegexElements(this.cells);
          addVerticalRegexElements(this.cells);
        };

        this.getAnswer = function () {
          var answer = '';

          this.cells.forEach(function (c) {
            answer += c.getValue() || emptyCellPlaceholder;
          });

          return answer;
        };

        this.setAnswer = function (answer) {
          var i;

          for (i = 0; i < this.cells.length; i++) {
            if (i >= answer.length) {
              break;
            }

            this.cells[i].setValue(answer[i]);

            scope.$apply();
          }

          logger.warn('todo: set answer to: ' + answer);
        };
      },

      HexagonalPuzzleAdapter = function () {
        this.init = function () {
          logger.warn('todo!');
        };
      },

      UI = function () {
        var addButton = function (name) {
          var newBtn, controlContainer;

          newBtn = d.createElement('button');
          newBtn.type = 'button';
          newBtn.classList.add('btn');
          newBtn.classList.add('btn-default');
          newBtn.textContent = name;

          controlContainer = topElement.querySelector('h1');

          controlContainer.appendChild(document.createTextNode(' '));
          controlContainer.appendChild(newBtn);

          return newBtn;
        };

        this.init = function () {
          var saveBtn, loadBtn;

          saveBtn = addButton('Save');
          saveBtn.addEventListener('click', this.onSaveClick);

          loadBtn = addButton('Load');
          loadBtn.addEventListener('click', this.onLoadClick);
        };

        this.getTextBoxes = function () {
          return topElement.querySelectorAll('input.char');
        };
      };

    if (!puzzle) {
      // puzzle not yet loaded...
      return;
    }

    persistence = {
      load: function () {
        return w.prompt('Enter previous solution:');
      },
      save: function (currentSolution) {
        w.prompt('Put this in a safe place:', currentSolution);
      }
    };

    ui = new UI();

    puzzleAdapter = puzzle.hexagonal
      ? new HexagonalPuzzleAdapter()
      : new RectangularPuzzleAdapter();

    ui.onLoadClick = function () {
      logger.info('loading.');
      puzzleAdapter.setAnswer(persistence.load());
    };
    ui.onSaveClick = function () {
      logger.info('saving.');
      persistence.save(puzzleAdapter.getAnswer());
    };

    ui.init();
    puzzleAdapter.init();

    puzzleAdapter.onAnswerChange = function () {
      puzzleAdapter.validate();
    };
  }

  function onViewChanged() {
    logger.log('View changed!');

    var scope, puzzleListTitleElement,
      puzzleElement = d.querySelector('div.challenge-puzzle') || d.querySelector('div.playerpuzzle');

    if (puzzleElement) {
      scope = angular.element(puzzleElement).scope();
      addPuzzleFunctionality(scope, puzzleElement);
      return;
    }

    puzzleListTitleElement = d.querySelector('div.container h2');

    if (puzzleListTitleElement && puzzleListTitleElement.textContent === 'Puzzles') {
      scope = angular.element(puzzleListTitleElement).scope();
      addPlayerPuzzlesPageFunctionality(scope, puzzleListTitleElement);
    }
  }

  function appendStyles() {
    var styleTag = d.createElement('style');
    styleTag.type = 'text/css';
    styleTag.textContent = '.clue-error{color:red;}.clue-ok{color:#2A2;}';
    d.head.appendChild(styleTag);
  }

  function start() {
    config.rootElement = d.querySelector('div[ng-view]');

    if (!config.rootElement) {
      logger.warn('root element not yet found.');
      w.setTimeout(start, 100);
      return;
    }

    appendStyles();

    logger.info('root element found!');
    config.rootScope = angular.element(config.rootElement).scope().$root;

    config.rootScope.$on('$viewContentLoaded', onViewChanged);
    onViewChanged();
  }

  start();

}(window, document));
