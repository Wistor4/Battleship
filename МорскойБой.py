import random
import os
import time

BOARD_SIZE = 10
SHIP_LENGTHS = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]


class Ship:
    def __init__(self, length):
        self.length = length
        self.coordinates = []
        self.hits = 0

    def is_sunk(self):
        return self.hits == self.length


class Board:
    def __init__(self):
        self.size = BOARD_SIZE
        self.grid = []
        for y in range(self.size):
            row = []
            for x in range(self.size):
                row.append("~")
            self.grid.append(row)
        self.ships = []
        self.shots = set()

    def display(self, hide_ships=False):
        print("   A B C D E F G H I J")

        for y in range(self.size):
            print(f"{y + 1:2}", end=" ")

            for x in range(self.size):
                cell = self.grid[y][x]

                if cell == "S":
                    cell = "~" if hide_ships else "#"

                print(cell, end=" ")

            print()

    def can_place_ship(self, x, y, length, horizontal):
        for i in range(length):
            current_x = x + i if horizontal else x
            current_y = y if horizontal else y + i

            if current_x >= self.size or current_y >= self.size:
                return False

            # Проверяем клетку корабля и клетки вокруг неё
            for dx in range(-1, 2):
                for dy in range(-1, 2):
                    check_x = current_x + dx
                    check_y = current_y + dy

                    if 0 <= check_x < self.size and 0 <= check_y < self.size:
                        if self.grid[check_y][check_x] == "S":
                            return False

        return True

    def place_ships(self):
        for length in SHIP_LENGTHS:
            while True:
                horizontal = random.choice([True, False])

                if horizontal:
                    x = random.randint(0, self.size - length)
                    y = random.randint(0, self.size - 1)
                else:
                    x = random.randint(0, self.size - 1)
                    y = random.randint(0, self.size - length)

                if self.can_place_ship(x, y, length, horizontal):
                    ship = Ship(length)

                    for i in range(length):
                        ship_x = x + i if horizontal else x
                        ship_y = y if horizontal else y + i

                        self.grid[ship_y][ship_x] = "S"
                        ship.coordinates.append((ship_x, ship_y))

                    self.ships.append(ship)
                    break

    def shoot(self, x, y):
        if (x, y) in self.shots:
            return "already"

        self.shots.add((x, y))

        if self.grid[y][x] == "S":
            self.grid[y][x] = "X"

            for ship in self.ships:
                if (x, y) in ship.coordinates:
                    ship.hits += 1

                    if ship.is_sunk():
                        return "sunk"

                    return "hit"

        else:
            self.grid[y][x] = "O"
            return "miss"


class AI:
    def __init__(self):
        self.targets = []

    def move(self, board):
        # Если было попадание, сначала проверяем соседние клетки
        while self.targets:
            x, y = self.targets.pop(0)

            if (x, y) not in board.shots:
                result = board.shoot(x, y)

                if result == "hit":
                    self.add_targets(x, y, board)

                elif result == "sunk":
                    self.targets.clear()

                return x, y, result

        # Обычный случайный выстрел
        while True:
            x = random.randint(0, 9)
            y = random.randint(0, 9)

            if (x, y) not in board.shots:
                result = board.shoot(x, y)

                if result == "hit":
                    self.add_targets(x, y, board)

                return x, y, result

    def add_targets(self, x, y, board):
        directions = [
            (1, 0),
            (-1, 0),
            (0, 1),
            (0, -1)
        ]

        random.shuffle(directions)

        for dx, dy in directions:
            new_x = x + dx
            new_y = y + dy

            if 0 <= new_x < board.size and 0 <= new_y < board.size:
                if (new_x, new_y) not in board.shots:
                    if (new_x, new_y) not in self.targets:
                        self.targets.append((new_x, new_y))


class Game:
    def __init__(self):
        self.player_board = Board()
        self.enemy_board = Board()
        self.ai = AI()

        self.player_board.place_ships()
        self.enemy_board.place_ships()

    def clear_screen(self):
        os.system("cls" if os.name == "nt" else "clear")

    def get_coordinates(self):
        while True:
            text = input("\nВведите координаты (например A5 или J10): ").upper().strip()

            if text == "Q":
                return None, None

            try:
                column = ord(text[0]) - ord("A")
                row = int(text[1:]) - 1

                if 0 <= column < 10 and 0 <= row < 10:
                    return column, row

                print("Координаты должны быть от A1 до J10.")

            except (ValueError, IndexError):
                print("Неверный формат. Пример: A5")

    def print_result(self, result, coordinate):
        if result == "miss":
            print(f"{coordinate} - промах.")

        elif result == "hit":
            print(f"{coordinate} - попадание.")

        elif result == "sunk":
            print(f"{coordinate} - корабль потоплен.")

    def all_ships_sunk(self, board):
        for ship in board.ships:
            if not ship.is_sunk():
                return False

        return True

    def play(self):
        print("=" * 40)
        print("          МОРСКОЙ БОЙ")
        print("=" * 40)

        print("\nОбозначения:")
        print("# - корабль")
        print("~ - вода")
        print("X - попадание")
        print("O - промах")
        print("Q - выход из игры")

        input("\nНажмите Enter, чтобы начать...")

        while True:
            self.clear_screen()

            print("ВАШЕ ПОЛЕ")
            self.player_board.display()

            print("\nПОЛЕ ПРОТИВНИКА")
            self.enemy_board.display(hide_ships=True)

            # Ход игрока
            print("\nВаш ход")

            while True:
                x, y = self.get_coordinates()

                if x is None:
                    print("Игра завершена.")
                    return

                result = self.enemy_board.shoot(x, y)

                if result == "already":
                    print("Вы уже стреляли в эту клетку.")
                else:
                    break

            coordinate = f"{chr(x + ord('A'))}{y + 1}"
            self.print_result(result, coordinate)

            if self.all_ships_sunk(self.enemy_board):
                print("\nВы победили!")
                break

            input("\nНажмите Enter для хода противника...")

            # Ход компьютера
            x, y, result = self.ai.move(self.player_board)

            coordinate = f"{chr(x + ord('A'))}{y + 1}"

            print(f"\nПротивник стреляет в {coordinate}.")
            self.print_result(result, coordinate)

            if self.all_ships_sunk(self.player_board):
                print("\nВы проиграли.")
                break

            time.sleep(1)

        print("\nФинальное поле:")

        if self.all_ships_sunk(self.enemy_board):
            self.enemy_board.display()
        else:
            self.player_board.display()


if __name__ == "__main__":
    game = Game()
    game.play()

    input("\nНажмите Enter для выхода...")