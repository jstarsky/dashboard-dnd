import React, {Fragment} from 'react';
import PropTypes from 'prop-types';
import {render} from 'react-dom';
import HTML5Backend from 'react-dnd-html5-backend';
import {DragDropContext, DropTarget, DragSource, DragLayer} from 'react-dnd';
import cn from 'classnames';
import FlipMove from 'react-flip-move';
import _ from 'lodash';
import './styles.css';

// - - - utils.js

function moveItem(array, source, dest) {
  const arrayCopy = [...array];
  // If dest is after source, account for offset created by deletion.
  const insertAt = source > dest ? dest : dest + 1;
  // If dest is before source, account for offset created by insertion.
  const deleteAt = source > dest ? source + 1 : source;
  arrayCopy.splice(insertAt, 0, array[source]);
  arrayCopy.splice(deleteAt, 1);

  return arrayCopy;
}

// - - - Card.js

function Card(props) {
  const el = (
    <div
      className={cn({
        Card: true,
        'Card--is-dragging': props.isDragging,
        'Card--half-width': props.width === 1
      })}
    >
      {props.isDraggable &&
        props.connectDragSource(<span className="Card__handle">☰</span>)}
      {props.children}
    </div>
  );

  return props.isDraggable ? props.connectDragPreview(el) : el;
}

// - - - DropZone.js

function DropZone(props) {
  const el = (
    <div
      className={cn({
        DropZone: true,
        'DropZone--half-width': props.width === 1,
        'DropZone--is-over': props.isOver
      })}
    >
      {props.children}
    </div>
  );

  return props.connectDropTarget(el);
}

// - - - draggable-utils.js

const DRAGGABLE_CARD = 'DRAGGABLE_CARD';

const cardSource = DragSource(
  DRAGGABLE_CARD,
  {
    beginDrag(props, monitor) {
      props.setDraggingId(props.id);

      return {
        id: props.id,
        isDragging: monitor.isDragging()
      };
    },

    endDrag(props) {
      props.setDraggingId(null);
      props.onDropSuccess();
    }
  },
  (connect, monitor) => ({
    connectDragSource: connect.dragSource(),
    connectDragPreview: connect.dragPreview(),
    isDragging: monitor.isDragging()
  })
);

let counter = 1;
const cardTarget = DropTarget(
  DRAGGABLE_CARD,
  {
    hover(props, monitor) {
      const draggingItem = monitor.getItem();
      if (draggingItem.id !== props.id) {
        props.moveItem(draggingItem, {id: props.id});
        return;
      }

      if (props.isSpacer && props.isOverTarget !== false) {
        props.setIsOverTarget(false);
        return;
      }

      if (!props.isSpacer && props.isOverTarget !== true) {
        props.setIsOverTarget(true);
        return;
      }
    }
  },
  (connect, monitor) => ({
    connectDropTarget: connect.dropTarget(),
    isOver: monitor.isOver()
  })
);

// - - - Board.js

const DropZoneTarget = cardTarget(DropZone);
const CardSource = cardSource(Card);

class Board extends React.Component {
  static propTypes = {
    cards: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.number.isRequired,
        width: PropTypes.oneOf([1, 2]).isRequired
      })
    ).isRequired,
    updateCardsOrder: PropTypes.func.isRequired
  };

  getInitialState = () => ({
    draggingId: null,
    isOverTarget: false,
    draggingEnabled: true,
    flipping: false,
    cards: this.props.cards
  });

  state = this.getInitialState();

  resetState = () => this.setState(this.getInitialState());

  setDraggingId = draggingId => this.setState({draggingId});

  setIsOverTarget = isOverTarget => this.setState({isOverTarget});

  idToIndex = id => this.state.cards.findIndex(item => item.id === id);
  indexToId = i => this.state.cards[i].id;

  lastPairMoved = [null, null];
  moveItem = (draggingItem, droppingItem) => {
    const {cards, flipping} = this.state;

    const currentPairMoved = [draggingItem.id, droppingItem.id];
    if (
      flipping &&
      this.lastPairMoved[0] === currentPairMoved[0] &&
      this.lastPairMoved[1] === currentPairMoved[1]
    ) {
      return;
    }
    this.lastPairMoved = currentPairMoved;

    let [sourceIndex, destIndex] = [draggingItem, droppingItem]
      .map(({id}) => id)
      .map(this.idToIndex);

    console.log(sourceIndex, destIndex);

    if (destIndex === sourceIndex + 1) {
      // Allow dragging i to i + 1
      [sourceIndex, destIndex] = [destIndex, sourceIndex];
    }

    this.setState({
      cards: moveItem(cards, sourceIndex, destIndex),
      isOverTarget: false
    });
  };

  updateCardsOrder = () => {
    this.props.updateCardsOrder(this.state.cards.map(card => card.id));
  };

  render() {
    const {cards, draggingId, draggingEnabled} = this.state;

    let widthSum = 0;
    return (
      <div className="App">
        <div className="buttons">
          <button onClick={this.resetState}>Reset</button>
          <button
            onClick={() => this.setState({draggingEnabled: !draggingEnabled})}
          >
            {draggingEnabled ? 'Disable' : 'Enable'} Dragging
          </button>
        </div>

        <hr />

        <div>
          <FlipMove
            duration={200}
            easing="ease-out"
            className={cn('Board', this.state.flipping && 'flipping')}
            onStart={() => this.setState({flipping: true})}
            onFinish={() => this.setState({flipping: false})}
          >
            {cards.map((item, i, arr) => {
              const widthSumIsEven = widthSum % 2 === 0;
              const prevItem = arr[i - 1];

              // prependHalfSpacer for case:
              // | 1 | SPACER(1) |
              // |       2       |
              const prependHalfSpacer = !widthSumIsEven && item.width === 2;

              // prependTwoHalfSpacer for case:
              // |     1     | INVISIBLE(2) |
              // | SPACER(2) |   SPACER(2)  |
              // |           3              |
              const prependTwoHalfSpacers =
                i >= 2 &&
                draggingId === prevItem.id &&
                !this.state.isOverTarget &&
                item.width === 2 &&
                prevItem.width === 1 &&
                widthSumIsEven;

              // Update widthSum after performing prepend*Spacer calculations
              widthSum +=
                item.width +
                Number(prependHalfSpacer) +
                Number(prependTwoHalfSpacers) * 2;

              const isOverTargetProps = {
                isOverTarget: this.state.isOverTarget,
                setIsOverTarget: this.setIsOverTarget
              };

              const spacerProps = prevItem && {
                id: prevItem.id,
                width: 1,
                moveItem: this.moveItem,
                isSpacer: true,
                ...isOverTargetProps
              };

              const boardCardProps = {
                key: item.id,
                item,
                prependHalfSpacer,
                prependTwoHalfSpacers,
                spacerProps,
                isOverTargetProps,
                moveItem: this.moveItem,
                setDraggingId: this.setDraggingId,
                updateCardsOrder: this.updateCardsOrder,
                draggingEnabled
              };

              return <BoardCard {...boardCardProps} />;
            })}
          </FlipMove>
        </div>
      </div>
    );
  }
}

class BoardCard extends React.Component {
  render() {
    const {
      item,
      prependHalfSpacer,
      prependTwoHalfSpacers,
      spacerProps,
      isOverTargetProps,
      moveItem,
      setDraggingId,
      updateCardsOrder,
      draggingEnabled
    } = this.props;

    return (
      <Fragment>
        {prependHalfSpacer && <DropZoneTarget {...spacerProps} />}
        {prependTwoHalfSpacers && [
          <DropZoneTarget key={0} {...spacerProps} />,
          <DropZoneTarget key={1} {...spacerProps} />
        ]}
        <DropZoneTarget {...item} {...isOverTargetProps} moveItem={moveItem}>
          <CardSource
            {...item}
            setDraggingId={setDraggingId}
            onDropSuccess={updateCardsOrder}
            isDraggable={draggingEnabled}
          >
            Card {item.id}
          </CardSource>
        </DropZoneTarget>
      </Fragment>
    );
  }
}

// - - - BoardApp.js

const BoardApp = DragDropContext(HTML5Backend)(Board);

const cards = [
  {id: 1, width: 1},
  {id: 2, width: 2},
  {id: 3, width: 1},
  {id: 4, width: 1},
  {id: 5, width: 1},
  {id: 6, width: 2},
  {id: 7, width: 1}
];

render(
  <BoardApp
    cards={cards}
    updateCardsOrder={cardIds => console.log('updateCardsOrder', cardIds)}
  />,
  document.getElementById('root')
);
